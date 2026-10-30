import { useState } from 'react';
import { ArrowUpRight, Code2, Database, GraduationCap, Mail, Menu, Monitor, Sparkles } from 'lucide-react';

const projects = [
  {
    title: 'School Management System',
    category: 'Currently Working',
    description: 'विद्यालयको दैनिक प्रशासन, विद्यार्थी व्यवस्थापन, परीक्षा, शुल्क तथा लेखा व्यवस्थापनलाई एउटै डिजिटल प्रणालीमा जोड्ने परियोजना।',
    status: 'In Development',
    icon: GraduationCap,
    featured: true
  },
  {
    title: 'Smart Accounting Suite',
    category: 'Accounting',
    description: 'विद्यालय तथा संस्थाको आम्दानी, खर्च, भौचर, बैंक र वित्तीय प्रतिवेदन व्यवस्थापनका लागि तयार गरिएको प्रणाली।',
    status: 'Part of School Management System',
    icon: Database
  },
  {
    title: 'Web Applications',
    category: 'Development',
    description: 'व्यवसाय तथा संस्थाका आवश्यकताअनुसार आधुनिक वेब समाधान निर्माण गर्ने कार्यक्षेत्र।',
    status: 'Selected Work',
    icon: Monitor
  }
];

export default function PortfolioDashboard({ onOpenSchool }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Currently Working', 'Accounting', 'Development'];
  const visibleProjects = projects.filter(project => activeFilter === 'All' || project.category === activeFilter);

  return (
    <div className="amar-portfolio">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');
        .amar-portfolio{min-height:100vh;background:#080b14;color:#edf2ff;font-family:'DM Sans','Noto Sans Devanagari',sans-serif;overflow:hidden}
        .amar-portfolio *{box-sizing:border-box}.amar-wrap{width:min(1160px,calc(100% - 44px));margin:auto}
        .amar-nav{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #20283b}
        .amar-brand{font:800 20px Manrope,sans-serif;letter-spacing:-.8px;color:#fff}.amar-brand span{color:#65d6ff}
        .amar-links{display:flex;gap:28px;align-items:center}.amar-links a{color:#aab6cc;text-decoration:none;font-size:13px}.amar-links a:hover{color:#fff}
        .amar-btn{border:1px solid #35425d;border-radius:10px;padding:11px 16px;background:#131c2e;color:#eaf4ff;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;gap:8px;align-items:center;text-decoration:none}
        .amar-btn.primary{background:linear-gradient(110deg,#2469a8,#6252b9);border:0;color:#fff;box-shadow:0 10px 30px #315eb633}
        .amar-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:50px;align-items:center;padding:95px 0 85px;min-height:560px}
        .amar-kicker{display:inline-flex;gap:8px;align-items:center;color:#7cdbff;background:#11283a;border:1px solid #214765;border-radius:30px;padding:8px 13px;font-size:12px;font-weight:700}
        .amar-hero h1{font:800 clamp(42px,6vw,70px)/1.06 Manrope,sans-serif;letter-spacing:-3px;margin:22px 0 8px;color:#fff}
        .amar-hero h1 span{background:linear-gradient(100deg,#6dd5ff,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
        .amar-nepali{font-size:20px;color:#a8b7d0;font-weight:600;margin:0 0 20px}
        .amar-lead{max-width:620px;color:#aab6cc;font-size:16px;line-height:1.9;margin:0 0 28px}
        .amar-actions{display:flex;gap:12px;flex-wrap:wrap}
        .amar-visual{position:relative;min-height:330px;display:grid;place-items:center}
        .amar-orbit{width:290px;height:290px;border-radius:50%;border:1px solid #31466a;display:grid;place-items:center;box-shadow:0 0 90px #3463a326,inset 0 0 55px #263d622b;position:relative}
        .amar-orbit:before,.amar-orbit:after{content:'';position:absolute;border:1px dashed #38577b;border-radius:50%;inset:22px}.amar-orbit:after{inset:-20px;border-color:#273b59}
        .amar-monogram{width:178px;height:178px;border-radius:42px;display:grid;place-items:center;background:linear-gradient(145deg,#1c4770,#493c83);font:800 58px Manrope,sans-serif;color:#fff;box-shadow:0 25px 65px #0008;border:1px solid #7594c0}
        .amar-float{position:absolute;padding:10px 14px;border-radius:12px;background:#131d30;border:1px solid #2d3e5b;color:#dbe8ff;font-size:12px;font-weight:700;box-shadow:0 10px 30px #0005}
        .amar-float.one{top:30px;right:0}.amar-float.two{bottom:42px;left:0}
        .amar-section{padding:72px 0;border-top:1px solid #1d2638}
        .amar-section-head{margin-bottom:28px}.amar-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#72cfff;font-weight:800}
        .amar-section h2{font:800 32px Manrope,sans-serif;letter-spacing:-1px;margin:10px 0;color:#fff}
        .amar-section-head p{color:#99a9c2;line-height:1.8;margin:0;max-width:700px;font-size:14px}
        .amar-about-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .amar-info-card,.amar-project{background:linear-gradient(145deg,#111a2b,#0d1422);border:1px solid #26334a;border-radius:17px;padding:23px}
        .amar-info-card svg{color:#77d5ff}.amar-info-card h3{font-size:16px;color:#f4f7ff;margin:16px 0 8px}.amar-info-card p{font-size:13px;line-height:1.8;color:#9eacc3;margin:0}
        .amar-filter{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px}.amar-filter button{border:1px solid #2b3850;border-radius:30px;background:#111a2b;color:#aab8ce;padding:8px 13px;font-size:12px;cursor:pointer}.amar-filter button.active{background:#1e5279;color:#fff;border-color:#3978a5}
        .amar-project-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.amar-project{display:flex;flex-direction:column;min-height:260px;transition:transform .2s,border-color .2s}.amar-project:hover{transform:translateY(-4px);border-color:#5475a0}
        .amar-project.featured{border-color:#3c75a4;background:linear-gradient(145deg,#142941,#10182a)}
        .amar-project-top{display:flex;align-items:center;justify-content:space-between}.amar-project-icon{width:42px;height:42px;display:grid;place-items:center;background:#1b3550;border-radius:12px;color:#7bd8ff}
        .amar-status{font-size:10px;color:#8de0c2;background:#13352f;padding:6px 9px;border-radius:20px}
        .amar-project h3{font-size:17px;margin:20px 0 8px;color:#fff}.amar-project p{font-size:13px;line-height:1.8;color:#a2b0c6;margin:0 0 18px}
        .amar-project .amar-btn{margin-top:auto;align-self:flex-start}.amar-note{color:#8294b0;font-size:11px;margin-top:10px}
        .amar-contact{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px;border-radius:18px;border:1px solid #2a3d59;background:linear-gradient(110deg,#142a43,#191b36)}
        .amar-contact h2{margin:0 0 7px;font-size:25px}.amar-contact p{margin:0;color:#afbdd1;font-size:13px}
        .amar-footer{border-top:1px solid #1e293b;padding:25px 0;color:#7889a5;font-size:12px;display:flex;justify-content:space-between;gap:12px}
        @media(max-width:800px){.amar-hero{grid-template-columns:1fr;padding:65px 0;gap:20px}.amar-visual{min-height:290px}.amar-about-grid,.amar-project-grid{grid-template-columns:1fr 1fr}.amar-links{display:none}.amar-contact{align-items:flex-start;flex-direction:column}}
        @media(max-width:560px){.amar-wrap{width:min(100% - 30px,1160px)}.amar-about-grid,.amar-project-grid{grid-template-columns:1fr}.amar-hero h1{letter-spacing:-2px}.amar-section{padding:55px 0}.amar-footer{flex-direction:column}}
      `}</style>
      <div className="amar-wrap">
        <header className="amar-nav">
          <a className="amar-brand" href="#home">AMAR<span>.</span></a>
          <nav className="amar-links">
            <a href="#home">Home</a><a href="#about">About & Skills</a><a href="#projects">Projects</a><a href="#contact">Contact</a>
          </nav>
          <a className="amar-btn" href="#contact">Get in touch <ArrowUpRight size={15}/></a>
        </header>
        <main>
          <section className="amar-hero" id="home">
            <div>
              <div className="amar-kicker"><Sparkles size={14}/> PERSONAL PORTFOLIO</div>
              <h1>Hi, I'm <span>Amar Bartaula</span></h1>
              <p className="amar-nepali">अमर बर्तौला</p>
              <p className="amar-lead">I create practical digital solutions with a focus on software, school administration, and accounting workflows. Explore my current work and projects.</p>
              <div className="amar-actions">
                <a className="amar-btn primary" href="#projects">Explore Projects <ArrowUpRight size={16}/></a>
                <a className="amar-btn" href="#contact"><Mail size={15}/> Contact</a>
              </div>
            </div>
            <div className="amar-visual" aria-label="Amar Bartaula portfolio monogram">
              <div className="amar-orbit"><div className="amar-monogram">AB</div></div>
              <div className="amar-float one"><Code2 size={14} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/> Software Projects</div>
              <div className="amar-float two"><Database size={14} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/> Digital Systems</div>
            </div>
          </section>
          <section className="amar-section" id="about">
            <div className="amar-section-head"><div className="amar-eyebrow">About & Skills</div><h2>Building useful digital experiences</h2><p>My work focuses on turning day-to-day organizational needs into clear, dependable digital workflows.</p></div>
            <div className="amar-about-grid">
              <article className="amar-info-card"><Code2 size={25}/><h3>Frontend Development</h3><p>Responsive interfaces, clean layouts, and practical user experiences for web applications.</p></article>
              <article className="amar-info-card"><Database size={25}/><h3>Backend & Database</h3><p>Application logic, data organization, and connecting user interfaces with backend services.</p></article>
              <article className="amar-info-card"><GraduationCap size={25}/><h3>School Systems</h3><p>Digital workflows for student records, examinations, fees, administration, and accounting.</p></article>
            </div>
          </section>
          <section className="amar-section" id="projects">
            <div className="amar-section-head"><div className="amar-eyebrow">Selected Work</div><h2>Projects</h2><p>Explore current and selected software projects. The school management system is the active project.</p></div>
            <div className="amar-filter">{filters.map(filter=><button key={filter} className={activeFilter===filter?'active':''} onClick={()=>setActiveFilter(filter)}>{filter}</button>)}</div>
            <div className="amar-project-grid">
              {visibleProjects.map(project=>{const Icon=project.icon;return <article className={`amar-project ${project.featured?'featured':''}`} key={project.title}>
                <div className="amar-project-top"><div className="amar-project-icon"><Icon size={21}/></div><span className="amar-status">{project.status}</span></div>
                <h3>{project.title}</h3><p>{project.description}</p>
                {project.featured?<button className="amar-btn primary" onClick={onOpenSchool}>Open School Management System <ArrowUpRight size={15}/></button>:<span className="amar-note">{project.category}</span>}
              </article>})}
            </div>
          </section>
          <section className="amar-section" id="contact">
            <div className="amar-contact"><div><h2>Let's build something useful.</h2><p>For project discussions and collaboration, get in touch.</p><div style={{display:"flex",flexDirection:"column",gap:12,marginTop:18}}><a href="tel:+9779845433722" style={{color:"#dbe8ff",textDecoration:"none"}}>Phone: +977 9845433722</a><a href="mailto:amarbartaula360@gmail.com" style={{color:"#dbe8ff",textDecoration:"none"}}>Email: amarbartaula360@gmail.com</a><a href="https://www.facebook.com/lbartaula" target="_blank" rel="noreferrer" style={{color:"#dbe8ff",textDecoration:"none"}}>Facebook: www.facebook.com/lbartaula</a></div></div><a className="amar-btn primary" href="mailto:amarbartaula360@gmail.com">Email <Mail size={15}/></a></div>
          </section>
        </main>
        <footer className="amar-footer"><span>© {new Date().getFullYear()} Amar Bartaula</span><span>Personal Portfolio · Software & Digital Solutions</span></footer>
      </div>
    </div>
  );
}
