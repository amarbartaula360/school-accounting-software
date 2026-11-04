import express from 'express';

export function registerPayrollRoutes(app, pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  const orgId = req => Number(req.authUser.organization_id);
  const money = value => Number(value || 0);

  router.get('/dashboard', async (req,res) => {
    try {
      const id=orgId(req);
      const [staff,attendance,payroll,advances]=await Promise.all([
        pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM payroll_staff WHERE organization_id=$1',[id]),
        pool.query("SELECT COUNT(*) FILTER (WHERE status='present')::int AS present, COUNT(*) FILTER (WHERE status='absent')::int AS absent, COUNT(*) FILTER (WHERE status='late')::int AS late FROM payroll_attendance WHERE organization_id=$1 AND attendance_date=CURRENT_DATE",[id]),
        pool.query('SELECT COALESCE(SUM(total_net),0) AS latest_net, MAX(period_bs) AS latest_period FROM payroll_runs WHERE organization_id=$1',[id]),
        pool.query("SELECT COALESCE(SUM(amount-recovered_amount),0) AS outstanding FROM payroll_advances WHERE organization_id=$1 AND status='open'",[id])
      ]);
      res.json({staff:staff.rows[0],attendance:attendance.rows[0],payroll:payroll.rows[0],advances:advances.rows[0]});
    } catch(e){ console.error('Payroll dashboard:',e); res.status(500).json({message:'Payroll dashboard load भएन।'}); }
  });

  router.get('/staff', async(req,res)=>{
    try { const r=await pool.query('SELECT * FROM payroll_staff WHERE organization_id=$1 ORDER BY is_active DESC,full_name',[orgId(req)]); res.json(r.rows); }
    catch(e){res.status(500).json({message:'Staff list load भएन।'});}
  });
  router.post('/staff', async(req,res)=>{
    const b=req.body||{};
    if(!b.employeeCode||!b.fullName) return res.status(400).json({message:'कर्मचारी कोड र नाम आवश्यक छ।'});
    try{
      const r=await pool.query(`INSERT INTO payroll_staff(organization_id,employee_code,full_name,photo_url,designation,department,phone,email,address,join_date,employment_type,basic_salary,allowances,bank_name,bank_account_name,bank_account_number,pan_number,device_user_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [orgId(req),b.employeeCode,b.fullName,b.photoUrl||null,b.designation||null,b.department||null,b.phone||null,b.email||null,b.address||null,b.joinDate||null,b.employmentType||'permanent',money(b.basicSalary),money(b.allowances),b.bankName||null,b.bankAccountName||null,b.bankAccountNumber||null,b.panNumber||null,b.deviceUserId||null]);
      res.status(201).json(r.rows[0]);
    }catch(e){res.status(e.code==='23505'?409:500).json({message:e.code==='23505'?'यो कर्मचारी कोड पहिले नै प्रयोग भएको छ।':'कर्मचारी सुरक्षित गर्न सकिएन।'});}
  });
  router.put('/staff/:id',async(req,res)=>{
    const b=req.body||{};
    try{
      const r=await pool.query(`UPDATE payroll_staff SET full_name=COALESCE($3,full_name),photo_url=$4,designation=$5,department=$6,phone=$7,email=$8,address=$9,join_date=$10,employment_type=$11,basic_salary=$12,allowances=$13,bank_name=$14,bank_account_name=$15,bank_account_number=$16,pan_number=$17,device_user_id=$18,is_active=$19,updated_at=NOW()
      WHERE organization_id=$1 AND id=$2 RETURNING *`,
      [orgId(req),req.params.id,b.fullName||null,b.photoUrl||null,b.designation||null,b.department||null,b.phone||null,b.email||null,b.address||null,b.joinDate||null,b.employmentType||'permanent',money(b.basicSalary),money(b.allowances),b.bankName||null,b.bankAccountName||null,b.bankAccountNumber||null,b.panNumber||null,b.deviceUserId||null,b.isActive!==false]);
      if(!r.rowCount)return res.status(404).json({message:'कर्मचारी भेटिएन।'});res.json(r.rows[0]);
    }catch(e){res.status(500).json({message:'कर्मचारी विवरण update भएन।'});}
  });

  router.get('/attendance',async(req,res)=>{
    try{const r=await pool.query(`SELECT a.*,s.employee_code,s.full_name FROM payroll_attendance a JOIN payroll_staff s ON s.id=a.staff_id WHERE a.organization_id=$1 AND a.attendance_date BETWEEN COALESCE($2::date,CURRENT_DATE-INTERVAL '30 days') AND COALESCE($3::date,CURRENT_DATE) ORDER BY a.attendance_date DESC,s.full_name`,[orgId(req),req.query.from||null,req.query.to||null]);res.json(r.rows);}
    catch(e){res.status(500).json({message:'हाजिरी विवरण load भएन।'});}
  });
  router.post('/attendance/import',async(req,res)=>{
    const records=Array.isArray(req.body?.records)?req.body.records:[];
    if(!records.length||records.length>5000)return res.status(400).json({message:'१ देखि ५००० सम्म attendance records पठाउनुहोस्।'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');let count=0;
      for(const x of records){
        if(!x.deviceUserId||!x.date)continue;
        const s=await client.query('SELECT id FROM payroll_staff WHERE organization_id=$1 AND device_user_id=$2',[orgId(req),String(x.deviceUserId)]);
        if(!s.rowCount)continue;
        await client.query(`INSERT INTO payroll_attendance(organization_id,staff_id,attendance_date,check_in,check_out,work_minutes,late_minutes,overtime_minutes,status,source,device_record_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(organization_id,staff_id,attendance_date) DO UPDATE SET check_in=COALESCE(EXCLUDED.check_in,payroll_attendance.check_in),check_out=COALESCE(EXCLUDED.check_out,payroll_attendance.check_out),work_minutes=GREATEST(payroll_attendance.work_minutes,EXCLUDED.work_minutes),late_minutes=GREATEST(payroll_attendance.late_minutes,EXCLUDED.late_minutes),overtime_minutes=GREATEST(payroll_attendance.overtime_minutes,EXCLUDED.overtime_minutes),source=EXCLUDED.source`,
        [orgId(req),s.rows[0].id,x.date,x.checkIn||null,x.checkOut||null,Number(x.workMinutes||0),Number(x.lateMinutes||0),Number(x.overtimeMinutes||0),x.status||'present',x.source||'device',x.recordId||null]);count++;
      }
      await client.query('COMMIT');res.json({ok:true,imported:count});
    }catch(e){await client.query('ROLLBACK');console.error('Attendance import:',e);res.status(500).json({message:'Attendance import असफल भयो।'});}
    finally{client.release();}
  });

  router.get('/advances',async(req,res)=>{
    try{const r=await pool.query(`SELECT a.*,s.employee_code,s.full_name,(a.amount-a.recovered_amount) AS balance FROM payroll_advances a JOIN payroll_staff s ON s.id=a.staff_id WHERE a.organization_id=$1 ORDER BY a.advance_date DESC`,[orgId(req)]);res.json(r.rows);}
    catch(e){res.status(500).json({message:'Advance list load भएन।'});}
  });
  router.post('/advances',async(req,res)=>{
    const b=req.body||{};if(!b.staffId||!(money(b.amount)>0))return res.status(400).json({message:'कर्मचारी र सही पेश्की रकम आवश्यक छ।'});
    try{const r=await pool.query(`INSERT INTO payroll_advances(organization_id,staff_id,advance_date,amount,installment_amount,description,advance_type,installment_count,start_period_bs) SELECT $1,id,$3,$4,$5,$6,$7,$8,$9 FROM payroll_staff WHERE organization_id=$1 AND id=$2 RETURNING *`,[orgId(req),b.staffId,b.date||new Date().toISOString().slice(0,10),money(b.amount),(money(b.installmentAmount)|| (Number(b.installmentCount)>0?Math.ceil(money(b.amount)/Number(b.installmentCount)*100)/100:0)),b.description||null,b.advanceType||'salary_advance',b.installmentCount?Number(b.installmentCount):null,b.startPeriodBS||null]);if(!r.rowCount)return res.status(404).json({message:'कर्मचारी भेटिएन।'});res.status(201).json(r.rows[0]);}
    catch(e){res.status(500).json({message:'पेश्की सुरक्षित भएन।'});}
  });

  router.get('/heads',async(req,res)=>{
    try{const r=await pool.query('SELECT * FROM payroll_salary_heads WHERE organization_id=$1 ORDER BY display_order,id',[orgId(req)]);res.json(r.rows);}
    catch(e){res.status(500).json({message:'Salary headings load भएन।'});}
  });
  router.post('/heads',async(req,res)=>{
    const b=req.body||{};
    if(!b.headCode||!b.headName||!['earning','deduction','tax'].includes(b.headType)||!['fixed','percentage'].includes(b.calculationType)||money(b.amount)<0)return res.status(400).json({message:'शीर्षक, प्रकार र रकम सही राख्नुहोस्।'});
    try{
      const r=await pool.query(`INSERT INTO payroll_salary_heads(organization_id,head_code,head_name,head_type,calculation_type,amount,percentage_base,is_taxable,display_order)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[orgId(req),String(b.headCode).trim().toUpperCase(),String(b.headName).trim(),b.headType,b.calculationType,money(b.amount),b.percentageBase==='gross'?'gross':'basic',b.isTaxable!==false,Number(b.displayOrder||0)]);
      res.status(201).json(r.rows[0]);
    }catch(e){res.status(e.code==='23505'?409:500).json({message:e.code==='23505'?'यो Salary Code पहिले नै छ।':'शीर्षक सुरक्षित गर्न सकिएन।'});}
  });
  router.put('/heads/:id',async(req,res)=>{
    const b=req.body||{};
    try{
      const r=await pool.query(`UPDATE payroll_salary_heads SET head_name=$3,head_type=$4,calculation_type=$5,amount=$6,percentage_base=$7,is_taxable=$8,is_active=$9,display_order=$10
      WHERE organization_id=$1 AND id=$2 RETURNING *`,[orgId(req),req.params.id,b.headName,b.headType,b.calculationType,money(b.amount),b.percentageBase==='gross'?'gross':'basic',b.isTaxable!==false,b.isActive!==false,Number(b.displayOrder||0)]);
      if(!r.rowCount)return res.status(404).json({message:'शीर्षक भेटिएन।'});res.json(r.rows[0]);
    }catch(e){res.status(400).json({message:'शीर्षक update भएन।'});}
  });

  router.get('/runs',async(req,res)=>{
    try{const r=await pool.query('SELECT * FROM payroll_runs WHERE organization_id=$1 ORDER BY period_start DESC',[orgId(req)]);res.json(r.rows);}
    catch(e){res.status(500).json({message:'Payroll history load भएन।'});}
  });
  router.post('/runs',async(req,res)=>{
    const b=req.body||{};
    if(!/^\d{4}-\d{2}$/.test(String(b.periodBS||''))||!b.startDate||!b.endDate||b.startDate>b.endDate)return res.status(400).json({message:'वि.सं. महिना र सुरु/अन्त्य मिति सही राख्नुहोस्।'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');const id=orgId(req);
      const exists=await client.query('SELECT id FROM payroll_runs WHERE organization_id=$1 AND period_bs=$2',[id,b.periodBS]);
      if(exists.rowCount){await client.query('ROLLBACK');return res.status(409).json({message:'यो महिनाको Payroll पहिले नै बनेको छ।'});}
      const [staff,headResult]=await Promise.all([
        client.query('SELECT * FROM payroll_staff WHERE organization_id=$1 AND is_active=TRUE ORDER BY id',[id]),
        client.query('SELECT * FROM payroll_salary_heads WHERE organization_id=$1 AND is_active=TRUE ORDER BY display_order,id',[id])
      ]);
      const heads=headResult.rows;
      let totals={basic:0,allowances:0,overtime:0,deductions:0,tax:0,otherEarnings:0,advance:0,net:0};const items=[];
      for(const person of staff.rows){
        const att=await client.query(`SELECT COUNT(*) FILTER(WHERE status='absent')::int absent,COALESCE(SUM(overtime_minutes),0)::int overtime FROM payroll_attendance WHERE organization_id=$1 AND staff_id=$2 AND attendance_date BETWEEN $3 AND $4`,[id,person.id,b.startDate,b.endDate]);
        const days=att.rows[0],totalDays=Math.max(1,Number(b.workingDays||30));
        const basic=money(person.basic_salary),allow=money(person.allowances);
        const absentDeduction=Math.round((basic/totalDays)*days.absent*100)/100;
        const overtimeAmount=Math.round((basic/totalDays/8/60*days.overtime*1.5)*100)/100;
        const grossBase=basic+allow+overtimeAmount;
        const adv=await client.query("SELECT id,LEAST(amount-recovered_amount,CASE WHEN installment_amount>0 THEN installment_amount ELSE amount-recovered_amount END) AS due FROM payroll_advances WHERE organization_id=$1 AND staff_id=$2 AND status='open' AND amount>recovered_amount AND (start_period_bs IS NULL OR start_period_bs<=$3) ORDER BY advance_date,id FOR UPDATE",[id,person.id,b.periodBS]);
        const advanceDeduction=adv.rows.reduce((n,x)=>n+money(x.due),0);
        let otherEarnings=0,otherDeductions=0,taxDeduction=0;const breakdown=[];
        for(const h of [...heads].sort((a,b)=>(a.head_type==='earning'?0:1)-(b.head_type==='earning'?0:1))){
          const base=h.percentage_base==='gross'?(grossBase+otherEarnings):basic;
          const amount=h.calculation_type==='percentage'?Math.round(base*money(h.amount)/100*100)/100:money(h.amount);
          breakdown.push({id:h.id,code:h.head_code,name:h.head_name,type:h.head_type,calculationType:h.calculation_type,rate:money(h.amount),amount});
          if(h.head_type==='earning')otherEarnings+=amount;
          else if(h.head_type==='tax')taxDeduction+=amount;
          else otherDeductions+=amount;
        }
        const gross=grossBase+otherEarnings;
        const net=Math.max(0,gross-absentDeduction-otherDeductions-taxDeduction-advanceDeduction);
        totals.basic+=basic;totals.allowances+=allow;totals.overtime+=overtimeAmount;totals.deductions+=absentDeduction+otherDeductions;totals.tax+=taxDeduction;totals.otherEarnings+=otherEarnings;totals.advance+=advanceDeduction;totals.net+=net;
        items.push({staffId:person.id,basic,allow,overtimeAmount,absentDeduction,otherEarnings,otherDeductions,taxDeduction,advanceDeduction,net,advanceIds:adv.rows.map(x=>x.id),breakdown});
      }
      const run=await client.query(`INSERT INTO payroll_runs(organization_id,period_bs,period_start,period_end,total_basic,total_allowances,total_overtime,total_deductions,total_advance,total_net,total_other_earnings,total_tax,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[id,b.periodBS,b.startDate,b.endDate,totals.basic,totals.allowances,totals.overtime,totals.deductions,totals.advance,totals.net,totals.otherEarnings,totals.tax,req.authUser.id]);
      for(const x of items){
        await client.query(`INSERT INTO payroll_items(payroll_run_id,organization_id,staff_id,basic_salary,allowances,overtime_amount,absent_deduction,other_deductions,advance_deduction,net_salary,other_earnings,tax_deduction,salary_breakdown)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,[run.rows[0].id,id,x.staffId,x.basic,x.allow,x.overtimeAmount,x.absentDeduction,x.otherDeductions,x.advanceDeduction,x.net,x.otherEarnings,x.taxDeduction,JSON.stringify(x.breakdown)]);
        let remaining=x.advanceDeduction;
        for(const aid of x.advanceIds){if(remaining<=0)break;const adv=await client.query('SELECT amount,recovered_amount FROM payroll_advances WHERE id=$1 FOR UPDATE',[aid]);const used=Math.min(remaining,money(adv.rows[0].amount)-money(adv.rows[0].recovered_amount));await client.query("UPDATE payroll_advances SET recovered_amount=recovered_amount+$2,status=CASE WHEN recovered_amount+$2>=amount THEN 'closed' ELSE 'open' END WHERE id=$1",[aid,used]);remaining-=used;}
      }
      await client.query('COMMIT');res.status(201).json({run:run.rows[0],items:items.length});
    }catch(e){await client.query('ROLLBACK');console.error('Payroll generation:',e);res.status(500).json({message:'Payroll generate गर्न सकिएन।'});}
    finally{client.release();}
  });
  router.get('/reports',async(req,res)=>{
    try{const id=orgId(req);const r=await pool.query(`SELECT pr.id,pr.period_bs,pr.period_start,pr.period_end,pr.total_basic,pr.total_allowances,pr.total_overtime,pr.total_deductions,pr.total_advance,pr.total_net,COUNT(pi.id)::int AS staff_count,COALESCE(SUM(pi.paid_amount),0) AS paid_amount FROM payroll_runs pr LEFT JOIN payroll_items pi ON pi.payroll_run_id=pr.id WHERE pr.organization_id=$1 GROUP BY pr.id ORDER BY pr.period_start DESC`,[id]);res.json(r.rows);}
    catch(e){res.status(500).json({message:'Payroll report load भएन।'});}
  });
  router.get('/device',async(req,res)=>{
    try{const r=await pool.query('SELECT device_name,device_ip,device_port,device_type,last_sync_at FROM payroll_device_settings WHERE organization_id=$1',[orgId(req)]);res.json(r.rows[0]||{});}
    catch(e){res.status(500).json({message:'Device settings load भएन।'});}
  });
  router.put('/device',async(req,res)=>{
    const b=req.body||{};try{const r=await pool.query(`INSERT INTO payroll_device_settings(organization_id,device_name,device_ip,device_port,device_type,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(organization_id) DO UPDATE SET device_name=EXCLUDED.device_name,device_ip=EXCLUDED.device_ip,device_port=EXCLUDED.device_port,device_type=EXCLUDED.device_type,updated_at=NOW() RETURNING device_name,device_ip,device_port,device_type,last_sync_at`,[orgId(req),b.deviceName||null,b.ip||null,Number(b.port||4370),b.deviceType||null]);res.json(r.rows[0]);}
    catch(e){res.status(400).json({message:'Device IP वा Port सही छैन।'});}
  });
  app.use('/api/payroll',router);
}
