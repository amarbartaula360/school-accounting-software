import express from 'express';
import net from 'node:net';

export function registerPayrollRoutes(app, pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  const orgId = req => Number(req.authUser.organization_id);
  const money = value => Number(value || 0);

  router.get('/dashboard', async (req,res) => {
    try {
      const id=orgId(req);
      const [staff,attendanceRows,payroll,advances]=await Promise.all([
        pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM payroll_staff WHERE organization_id=$1',[id]),
        pool.query(`SELECT s.id,s.employee_code,s.full_name,s.designation,a.check_in,a.check_out,a.status,
          COALESCE(a.late_minutes,0)::int AS late_minutes,
          CASE WHEN a.status='late' THEN 'late'
               WHEN a.status='present' THEN 'present'
               WHEN a.status='absent' OR a.staff_id IS NULL THEN 'absent'
               ELSE a.status END AS attendance_group
          FROM payroll_staff s
          LEFT JOIN payroll_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND a.attendance_date=CURRENT_DATE
          WHERE s.organization_id=$1 AND s.is_active=true
          ORDER BY s.full_name`,[id]),
        pool.query('SELECT COALESCE(SUM(total_net),0) AS latest_net, MAX(period_bs) AS latest_period FROM payroll_runs WHERE organization_id=$1',[id]),
        pool.query("SELECT COALESCE(SUM(amount-recovered_amount),0) AS outstanding FROM payroll_advances WHERE organization_id=$1 AND status='open'",[id])
      ]);
      const attendanceLists={present:attendanceRows.rows.filter(x=>x.attendance_group==='present'),absent:attendanceRows.rows.filter(x=>x.attendance_group==='absent'),late:attendanceRows.rows.filter(x=>x.attendance_group==='late')};
      const attendance={present:attendanceLists.present.length,absent:attendanceLists.absent.length,late:attendanceLists.late.length};
      res.json({staff:staff.rows[0],attendance,attendanceLists,payroll:payroll.rows[0],advances:advances.rows[0]});
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
    if(!b.employeeCode||!b.fullName)return res.status(400).json({message:'कर्मचारी कोड र नाम आवश्यक छ।'});
    try{
      const r=await pool.query(`UPDATE payroll_staff SET employee_code=$3,full_name=$4,photo_url=$5,designation=$6,department=$7,phone=$8,email=$9,address=$10,join_date=$11,employment_type=$12,basic_salary=$13,allowances=$14,bank_name=$15,bank_account_name=$16,bank_account_number=$17,pan_number=$18,device_user_id=$19,is_active=$20,updated_at=NOW()
      WHERE organization_id=$1 AND id=$2 RETURNING *`,
      [orgId(req),req.params.id,String(b.employeeCode).trim(),String(b.fullName).trim(),b.photoUrl||null,b.designation||null,b.department||null,b.phone||null,b.email||null,b.address||null,b.joinDate||null,b.employmentType||'permanent',money(b.basicSalary),money(b.allowances),b.bankName||null,b.bankAccountName||null,b.bankAccountNumber||null,b.panNumber||null,b.deviceUserId||null,b.isActive!==false]);
      if(!r.rowCount)return res.status(404).json({message:'कर्मचारी भेटिएन।'});res.json(r.rows[0]);
    }catch(e){res.status(e.code==='23505'?409:500).json({message:e.code==='23505'?'यो कर्मचारी कोड अर्को कर्मचारीले प्रयोग गरिरहेको छ।':'कर्मचारी विवरण update भएन।'});}
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


  router.get('/attendance/requests',async(req,res)=>{
    try{
      const r=await pool.query(`SELECT q.*,s.employee_code,s.full_name,s.designation
        FROM payroll_attendance_requests q JOIN payroll_staff s ON s.id=q.staff_id
        WHERE q.organization_id=$1 ORDER BY q.created_at DESC LIMIT 500`,[orgId(req)]);
      res.json(r.rows);
    }catch(e){console.error('Attendance requests:',e);res.status(503).json({message:'Leave/Field Visit को database migration चलाउनुहोस्।'});}
  });
  router.post('/attendance/requests',async(req,res)=>{
    const b=req.body||{};
    const type=String(b.requestType||'');
    const start=String(b.startDate||'').slice(0,10),end=String(b.endDate||'').slice(0,10);
    if(!b.staffId||!['leave','field_visit'].includes(type)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||!String(b.reason||'').trim())
      return res.status(400).json({message:'कर्मचारी, अनुरोध प्रकार, सही मिति र कारण अनिवार्य छन्।'});
    if((Date.parse(end)-Date.parse(start))/86400000>90)return res.status(400).json({message:'एक पटकमा बढीमा ९० दिनको अनुरोध गर्न सकिन्छ।'});
    try{
      const staff=await pool.query('SELECT id FROM payroll_staff WHERE organization_id=$1 AND id=$2 AND is_active=true',[orgId(req),b.staffId]);
      if(!staff.rowCount)return res.status(404).json({message:'सक्रिय कर्मचारी भेटिएन।'});
      const overlap=await pool.query(`SELECT 1 FROM payroll_attendance_requests WHERE organization_id=$1 AND staff_id=$2 AND status IN ('pending','approved') AND daterange(start_date,end_date,'[]') && daterange($3::date,$4::date,'[]') LIMIT 1`,[orgId(req),b.staffId,start,end]);
      if(overlap.rowCount)return res.status(409).json({message:'यो अवधिमा पहिले नै Pending वा Approved अनुरोध छ।'});
      const r=await pool.query(`INSERT INTO payroll_attendance_requests(organization_id,staff_id,request_type,from_date,to_date,start_date,end_date,reason,status)
        VALUES($1,$2,$3,$4,$5,$4,$5,$6,'pending') RETURNING *`,[orgId(req),b.staffId,type,start,end,String(b.reason).trim()]);
      res.status(201).json(r.rows[0]);
    }catch(e){console.error('Create attendance request:',e);res.status(500).json({message:'अनुरोध सुरक्षित गर्न सकिएन। Migration चलाइएको छ कि जाँच्नुहोस्।'});}
  });
  router.patch('/attendance/requests/:id',async(req,res)=>{
    const status=String(req.body?.status||'');
    if(!['approved','rejected'].includes(status))return res.status(400).json({message:'Approved वा Rejected छान्नुहोस्।'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query(`SELECT * FROM payroll_attendance_requests WHERE organization_id=$1 AND id=$2 FOR UPDATE`,[orgId(req),req.params.id]);
      if(!found.rowCount){await client.query('ROLLBACK');return res.status(404).json({message:'अनुरोध भेटिएन।'});}
      const q=found.rows[0];
      if(q.status!=='pending'){await client.query('ROLLBACK');return res.status(409).json({message:'यो अनुरोध पहिले नै निर्णय भइसकेको छ।'});}
      await client.query(`UPDATE payroll_attendance_requests SET status=$3,admin_note=$4,decided_at=NOW(),decided_by=$5,updated_at=NOW() WHERE organization_id=$1 AND id=$2`,[orgId(req),req.params.id,status,String(req.body?.adminNote||'').trim()||null,String(req.authUser?.email||req.authUser?.username||'Admin')]);
      if(status==='approved'){
        const attendanceStatus=q.request_type==='leave'?'on_leave':'field_visit';
        await client.query(`INSERT INTO payroll_attendance(organization_id,staff_id,attendance_date,status,source)
          SELECT $1,$2,d::date,$5,'manual' FROM generate_series($3::date,$4::date,interval '1 day') d
          ON CONFLICT(organization_id,staff_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,source='manual'`,
          [orgId(req),q.staff_id,q.start_date,q.end_date,attendanceStatus]);
      }
      const result=await client.query(`SELECT q.*,s.employee_code,s.full_name,s.designation FROM payroll_attendance_requests q JOIN payroll_staff s ON s.id=q.staff_id WHERE q.organization_id=$1 AND q.id=$2`,[orgId(req),req.params.id]);
      await client.query('COMMIT');res.json(result.rows[0]);
    }catch(e){await client.query('ROLLBACK');console.error('Review attendance request:',e);res.status(500).json({message:'अनुरोधको निर्णय सुरक्षित गर्न सकिएन।'});}
    finally{client.release();}
  });

  router.get('/holidays',async(req,res)=>{
    try{const r=await pool.query('SELECT id,holiday_date,holiday_name FROM payroll_holidays WHERE organization_id=$1 ORDER BY holiday_date DESC',[orgId(req)]);res.json(r.rows);}
    catch(e){console.error('Holiday list:',e);res.status(500).json({message:'सार्वजनिक बिदा सूची load भएन।'});}
  });
  router.post('/holidays',async(req,res)=>{
    const date=String(req.body?.date||'').slice(0,10),name=String(req.body?.name||'').trim();
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)||!name)return res.status(400).json({message:'सही मिति र बिदाको नाम अनिवार्य छ।'});
    try{const r=await pool.query(`INSERT INTO payroll_holidays(organization_id,holiday_date,holiday_name) VALUES($1,$2,$3) ON CONFLICT(organization_id,holiday_date) DO UPDATE SET holiday_name=EXCLUDED.holiday_name RETURNING *`,[orgId(req),date,name]);res.status(201).json(r.rows[0]);}
    catch(e){console.error('Create holiday:',e);res.status(500).json({message:'सार्वजनिक बिदा सुरक्षित भएन। Migration चलाइएको छ कि जाँच्नुहोस्।'});}
  });
  router.delete('/holidays/:id',async(req,res)=>{
    try{const r=await pool.query('DELETE FROM payroll_holidays WHERE organization_id=$1 AND id=$2 RETURNING id',[orgId(req),req.params.id]);if(!r.rowCount)return res.status(404).json({message:'बिदा भेटिएन।'});res.json({ok:true});}
    catch(e){res.status(500).json({message:'बिदा हटाउन सकिएन।'});}
  });
  router.get('/attendance/report',async(req,res)=>{
    const from=String(req.query.from||'').slice(0,10),to=String(req.query.to||'').slice(0,10);
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(from)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(to)||to<from)return res.status(400).json({message:'रिपोर्टको सही सुरु र अन्तिम मिति राख्नुहोस्।'});
    try{
      const r=await pool.query(`WITH days AS (
        SELECT d::date AS work_date FROM generate_series($2::date,$3::date,interval '1 day') d
      ), matrix AS (
        SELECT s.id,s.employee_code,s.full_name,s.designation,d.work_date,
          a.status,a.late_minutes,
          EXISTS(SELECT 1 FROM payroll_holidays h WHERE h.organization_id=$1 AND h.holiday_date=d.work_date) AS is_holiday,
          EXTRACT(DOW FROM d.work_date)=6 AS is_weekend
        FROM payroll_staff s CROSS JOIN days d
        LEFT JOIN payroll_attendance a ON a.organization_id=$1 AND a.staff_id=s.id AND a.attendance_date=d.work_date
        WHERE s.organization_id=$1 AND s.is_active=true
      )
      SELECT id AS staff_id,employee_code,full_name,designation,
        COUNT(*) FILTER(WHERE is_holiday)::int AS holiday_days,
        COUNT(*) FILTER(WHERE is_weekend AND NOT is_holiday)::int AS weekend_days,
        COUNT(*) FILTER(WHERE NOT is_holiday AND NOT is_weekend AND status='present' AND COALESCE(late_minutes,0)=0)::int AS present_days,
        COUNT(*) FILTER(WHERE NOT is_holiday AND NOT is_weekend AND (status='late' OR COALESCE(late_minutes,0)>0))::int AS late_days,
        COUNT(*) FILTER(WHERE NOT is_holiday AND NOT is_weekend AND status='on_leave')::int AS leave_days,
        COUNT(*) FILTER(WHERE NOT is_holiday AND NOT is_weekend AND status='field_visit')::int AS field_visit_days,
        COUNT(*) FILTER(WHERE NOT is_holiday AND NOT is_weekend AND (status IS NULL OR status='absent'))::int AS absent_days
      FROM matrix GROUP BY id,employee_code,full_name,designation ORDER BY full_name`,[orgId(req),from,to]);
      res.json(r.rows);
    }catch(e){console.error('Attendance report:',e);res.status(500).json({message:'हाजिरी रिपोर्ट तयार भएन।'});}
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
  // Detailed employee payroll register with bank-transfer details.
  router.get('/runs/:id/items',async(req,res)=>{
    try{
      const r=await pool.query(`SELECT pi.*,s.employee_code,s.full_name,s.designation,s.bank_name,s.bank_account_name,s.bank_account_number
        FROM payroll_items pi JOIN payroll_staff s ON s.id=pi.staff_id
        JOIN payroll_runs pr ON pr.id=pi.payroll_run_id
        WHERE pi.organization_id=$1 AND pi.payroll_run_id=$2 ORDER BY s.full_name`,[orgId(req),req.params.id]);
      res.json(r.rows);
    }catch(e){res.status(500).json({message:'कर्मचारी तलब विवरण load भएन।'});}
  });
  // Record a bank transfer only after the operator confirms it was deposited.
  router.put('/items/:id/bank-transfer',async(req,res)=>{
    const b=req.body||{};
    const amount=money(b.paidAmount);
    if(!b.paymentReference||amount<=0)return res.status(400).json({message:'बैंक भौचर/Reference र शून्यभन्दा ठूलो जम्मा रकम आवश्यक छ।'});
    try{
      const current=await pool.query('SELECT net_salary FROM payroll_items WHERE organization_id=$1 AND id=$2',[orgId(req),req.params.id]);
      if(!current.rowCount)return res.status(404).json({message:'Payroll item भेटिएन।'});
      if(amount>money(current.rows[0].net_salary))return res.status(400).json({message:'जम्मा रकम Net Salary भन्दा बढी हुन मिल्दैन।'});
      const r=await pool.query(`UPDATE payroll_items SET paid_amount=$3,payment_method='bank_transfer',
        payment_reference=$4,paid_at=COALESCE($5::timestamptz,NOW())
        WHERE organization_id=$1 AND id=$2 RETURNING *`,[orgId(req),req.params.id,amount,String(b.paymentReference).trim(),b.paidAt||null]);
      res.json(r.rows[0]);
    }catch(e){res.status(500).json({message:'Bank transfer विवरण सुरक्षित भएन।'});}
  });
  // Add a clearly labelled set of 50 demo employees once per organization.
  router.post('/demo-staff',async(req,res)=>{
    const names=['आर्यन अधिकारी','स्मृति श्रेष्ठ','प्रकाश थापा','अनिता गुरुङ','सन्देश लामिछाने','पूजा कार्की','विवेक पौडेल','रचना तामाङ','सुशील भण्डारी','निशा मगर','रोशन खड्का','कविता शर्मा','दीपक बस्नेत','सरिता राई','सागर न्यौपाने','ममता चौधरी','अमित पोखरेल','सीता परियार','बिनोद दाहाल','अस्मिता महतो','राजेश घिमिरे','रीता काफ्ले','नवीन बर्तौला','सविना मोक्तान','कमल सुवेदी','प्रमिला तिमिल्सिना','मनोज उप्रेती','संगीता वाइबा','विकास श्रेष्ठ','एलिना अधिकारी','सन्तोष राना','मेनुका खनाल','अर्जुन सापकोटा','दीपा तामाङ','निरज लामिछाने','सुष्मा पौडेल','रमेश विश्वकर्मा','आशा गुरुङ','कृष्ण न्यौपाने','मिना थापा','अभिषेक कार्की','बिना राई','प्रदीप भुजेल','सिर्जना मगर','उज्ज्वल खड्का','लक्ष्मी चौधरी','समीर दाहाल','रोशनी पोखरेल','हरि घिमिरे','सविता श्रेष्ठ'];
    const client=await pool.connect();
    try{
      await client.query('BEGIN');const id=orgId(req);let inserted=0;
      for(let i=0;i<names.length;i++){
        const code='DEMO-'+String(i+1).padStart(3,'0');
        const r=await client.query(`INSERT INTO payroll_staff(organization_id,employee_code,full_name,designation,department,employment_type,basic_salary,allowances,bank_name,bank_account_name,bank_account_number,is_demo)
          VALUES($1,$2,$3,$4,$5,'permanent',$6,$7,'Demo Bank',$3,$8,TRUE)
          ON CONFLICT(organization_id,employee_code) DO NOTHING RETURNING id`,
          [id,code,names[i],['शिक्षक','लेखा सहायक','प्रशासन सहायक','कार्यालय सहयोगी','समन्वयक'][i%5],['शिक्षण','प्रशासन','लेखा','सहायक','समन्वय'][i%5],25000+(i%8)*2500,1500+(i%4)*500,'DEMO-AC-'+String(i+1).padStart(6,'0')]);
        inserted+=r.rowCount;
      }
      await client.query('COMMIT');res.json({ok:true,inserted,message:inserted+' demo staff थपिए।'});
    }catch(e){await client.query('ROLLBACK');console.error('Demo staff:',e);res.status(500).json({message:'Demo staff थप्न सकिएन। Migration चलेको छ कि जाँच्नुहोस्।'});}
    finally{client.release();}
  });

  router.get('/staff/:id/ledger',async(req,res)=>{
    try{
      const id=orgId(req),staffId=Number(req.params.id);
      if(!Number.isInteger(staffId)||staffId<=0)return res.status(400).json({message:'कर्मचारी ID सही छैन।'});
      const [staff,payroll,advances]=await Promise.all([
        pool.query('SELECT id,employee_code,full_name,designation,phone,email,address,join_date,bank_name,bank_account_name,bank_account_number,pan_number FROM payroll_staff WHERE organization_id=$1 AND id=$2',[id,staffId]),
        pool.query(`SELECT pr.id AS payroll_run_id,pr.period_bs,pr.period_start,pr.period_end,
          pi.basic_salary,pi.allowances,pi.overtime_amount,pi.absent_deduction,pi.other_deductions,
          pi.other_earnings,pi.tax_deduction,pi.advance_deduction,pi.net_salary,
          pi.paid_amount,pi.payment_reference,pi.paid_at
          FROM payroll_items pi JOIN payroll_runs pr ON pr.id=pi.payroll_run_id
          WHERE pi.organization_id=$1 AND pi.staff_id=$2 ORDER BY pr.period_start DESC`,[id,staffId]),
        pool.query(`SELECT id,advance_date,advance_type,description,amount,recovered_amount,status
          FROM payroll_advances WHERE organization_id=$1 AND staff_id=$2 ORDER BY advance_date DESC,id DESC`,[id,staffId])
      ]);
      if(!staff.rowCount)return res.status(404).json({message:'कर्मचारी भेटिएन।'});
      res.json({staff:staff.rows[0],payroll:payroll.rows,advances:advances.rows});
    }catch(e){console.error('Staff ledger:',e);res.status(500).json({message:'कर्मचारी Ledger तयार भएन।'});}
  });
  router.get('/reports',async(req,res)=>{
    try{const id=orgId(req);const r=await pool.query(`SELECT pr.id,pr.period_bs,pr.period_start,pr.period_end,pr.total_basic,pr.total_allowances,pr.total_overtime,pr.total_deductions,pr.total_advance,pr.total_net,COUNT(pi.id)::int AS staff_count,COALESCE(SUM(pi.paid_amount),0) AS paid_amount FROM payroll_runs pr LEFT JOIN payroll_items pi ON pi.payroll_run_id=pr.id WHERE pr.organization_id=$1 GROUP BY pr.id ORDER BY pr.period_start DESC`,[id]);res.json(r.rows);}
    catch(e){res.status(500).json({message:'Payroll report load भएन।'});}
  });
  router.get('/device',async(req,res)=>{
    try{const r=await pool.query('SELECT device_name,device_ip,device_port,device_type,last_sync_at FROM payroll_device_settings WHERE organization_id=$1',[orgId(req)]);res.json(r.rows[0]||{});}
    catch(e){res.status(500).json({message:'Device settings load भएन।'});}
  });
  router.post('/device/test-connection',async(req,res)=>{
    const ip=String(req.body?.ip||'').trim();
    const port=Number(req.body?.port||4370);
    const validIp=/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(ip);
    if(!validIp||!Number.isInteger(port)||port<1||port>65535)return res.status(400).json({ok:false,message:'IP Address वा TCP Port सही राख्नुहोस्।'});
    const socket=new net.Socket();let settled=false;
    const finish=(status,payload)=>{if(settled)return;settled=true;socket.destroy();res.status(status).json(payload);};
    socket.setTimeout(3500);
    socket.once('connect',()=>finish(200,{ok:true,message:`TCP Connection सफल भयो: ${ip}:${port}`}));
    socket.once('timeout',()=>finish(504,{ok:false,message:'Connection timeout भयो। IP, Port, LAN र Firewall जाँच गर्नुहोस्। Render Cloud बाट Private LAN IP पहुँच नहुन सक्छ; LAN Sync Agent बाट परीक्षण गर्नुहोस्।'}));
    socket.once('error',()=>finish(502,{ok:false,message:'Connection हुन सकेन। IP/Port, मेसिनको Network र Firewall जाँच गर्नुहोस्। Render Cloud बाट Private LAN IP सिधै पहुँच हुँदैन।'}));
    socket.connect(port,ip);
  });
  router.put('/device',async(req,res)=>{
    const b=req.body||{};try{const r=await pool.query(`INSERT INTO payroll_device_settings(organization_id,device_name,device_ip,device_port,device_type,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(organization_id) DO UPDATE SET device_name=EXCLUDED.device_name,device_ip=EXCLUDED.device_ip,device_port=EXCLUDED.device_port,device_type=EXCLUDED.device_type,updated_at=NOW() RETURNING device_name,device_ip,device_port,device_type,last_sync_at`,[orgId(req),b.deviceName||null,b.ip||null,Number(b.port||4370),b.deviceType||null]);res.json(r.rows[0]);}
    catch(e){res.status(400).json({message:'Device IP वा Port सही छैन।'});}
  });
  app.use('/api/payroll',router);
}
