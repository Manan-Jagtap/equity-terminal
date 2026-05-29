import React, { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine } from "recharts";
import { Search, TrendingUp, Activity, Calculator, Layers, ChevronRight, ArrowLeft, CircleDollarSign, Gauge, ShieldAlert, Info, Database, FileText, BarChart2, BookOpen } from "lucide-react";

/* ─── THEME ─────────────────────────────────────────────────────────────── */
const C = {
  bg:"#0b0d10", panel:"#13161b", panel2:"#181c22", line:"#262b33",
  text:"#e9e5db", dim:"#878d97", faint:"#5a606a",
  gold:"#d6a85a", goldDim:"#8a6f3c",
  green:"#46b98a", red:"#df6553", blue:"#5e93d6", purple:"#9b7fe8",
};
const mono = { fontFamily:"'JetBrains Mono',monospace" };
const serif = { fontFamily:"'Fraunces',serif" };
const sans = { fontFamily:"'Hanken Grotesk',sans-serif" };

/* ─── FORMATTERS ─────────────────────────────────────────────────────────── */
const fmt  = (n,d=0) => n==null||isNaN(n)?"—":n.toLocaleString("en-IN",{maximumFractionDigits:d,minimumFractionDigits:d});
const inr  = (n,d=0) => "₹"+fmt(n,d);
const pct  = (n,d=1) => n==null||isNaN(n)?"—":(n*100).toFixed(d)+"%";
const cr   = (n,d=0) => n==null||isNaN(n)?"—":fmt(n,d)+" cr";
const sign = (n) => n>=0?"+":"";

/* ─── SEED (fallback when API unreachable) ──────────────────────────────── */
function rng(seed){let s=Math.abs(seed)%2147483647||1;return()=>(s=(s*16807)%2147483647)/2147483647;}
function makeSeries(seed,start,drift,vol,n=250){
  const r=rng(seed);const out=[];let p=Math.max(start,1);
  for(let i=0;i<n;i++){p=p*(1+drift/n+(r()-0.5)*vol);out.push({i,close:+p.toFixed(1)});}
  return out;
}
const SEED=[
  {id:1,name:"Muthoot Finance",ticker:"MUTHOOTFIN",type:"financial",sector:"Gold Loan NBFC",price:3311,shares:40.1,equity:26500,netProfit:4470,nbfc:{aum:92000,gnpa:0.029,nnpa:0.026,crar:0.288,nim:0.115,roa:0.052,pledge:0},assumptions:{beta:1.05,riskFree:0.069,erp:0.065,forecastRoe:0.225,terminalRoe:0.155,payout:0.22,fadeYears:8,terminalGrowth:0.05},series:makeSeries(11,2800,0.20,0.022)},
  {id:2,name:"Manappuram Finance",ticker:"MANAPPURAM",type:"financial",sector:"Gold Loan NBFC",price:329,shares:84.6,equity:11900,netProfit:2200,nbfc:{aum:44000,gnpa:0.045,nnpa:0.040,crar:0.302,nim:0.135,roa:0.048,pledge:0},assumptions:{beta:1.20,riskFree:0.069,erp:0.065,forecastRoe:0.195,terminalRoe:0.140,payout:0.20,fadeYears:8,terminalGrowth:0.045},series:makeSeries(23,280,0.16,0.028)},
  {id:3,name:"Fedbank Financial",ticker:"FEDFINA",type:"financial",sector:"Diversified NBFC",price:161,shares:37.0,equity:2400,netProfit:280,nbfc:{aum:14500,gnpa:0.020,nnpa:0.015,crar:0.205,nim:0.080,roa:0.022,pledge:0},assumptions:{beta:1.10,riskFree:0.069,erp:0.065,forecastRoe:0.135,terminalRoe:0.135,payout:0.0,fadeYears:9,terminalGrowth:0.06},series:makeSeries(37,130,0.22,0.030)},
  {id:4,name:"Bajaj Finance",ticker:"BAJFINANCE",type:"financial",sector:"Diversified NBFC",price:935,shares:62.0,equity:95000,netProfit:16700,nbfc:{aum:410000,gnpa:0.010,nnpa:0.004,crar:0.219,nim:0.105,roa:0.045,pledge:0},assumptions:{beta:1.15,riskFree:0.069,erp:0.065,forecastRoe:0.215,terminalRoe:0.160,payout:0.10,fadeYears:10,terminalGrowth:0.06},series:makeSeries(71,800,0.14,0.020)},
  {id:5,name:"Titan Company",ticker:"TITAN",type:"nonfinancial",sector:"Consumer / Retail",price:4155,shares:88.8,equity:12000,netProfit:3900,fcff:{revenue:56000,netDebt:8000,costDebt:0.085,debtWeight:0.15},assumptions:{beta:0.95,riskFree:0.069,erp:0.065,ebitMargin:0.115,taxRate:0.25,reinvestRate:0.40,revGrowth:0.135,fadeYears:9,terminalGrowth:0.055},series:makeSeries(91,3500,0.12,0.021)},
];

/* ─── BUILD COMPANY FROM API ROW ─────────────────────────────────────────── */
function buildFromApi(r){
  const seed=SEED.find(s=>s.ticker===r.ticker);
  if(seed)return{...seed,price:r.price};
  const ts=r.ticker.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const series=makeSeries(ts,r.price*0.85,0.10,0.025);
  const shares=r.pb&&r.intrinsic?(r.price/r.pb)*10:50;
  if(r.type==="financial"){
    const equity=r.pb?(r.price*shares)/r.pb:shares*200;
    return{id:r.ticker,name:r.name,ticker:r.ticker,type:"financial",sector:r.sector,price:r.price,shares,equity,netProfit:r.roe?equity*r.roe:null,
      nbfc:{aum:equity*4,gnpa:0.025,nnpa:0.015,crar:0.20,nim:0.09,roa:0.025,pledge:0},
      assumptions:{beta:1.1,riskFree:0.069,erp:0.065,forecastRoe:r.roe||0.15,terminalRoe:0.13,payout:0.20,fadeYears:8,terminalGrowth:0.05},series};
  }else{
    const equity=r.pb?(r.price*shares)/r.pb:shares*200;
    const netProfit=r.pe?(r.price*shares)/r.pe:null;
    return{id:r.ticker,name:r.name,ticker:r.ticker,type:"nonfinancial",sector:r.sector,price:r.price,shares,equity,netProfit,
      fcff:{revenue:r.price*shares*0.8,netDebt:r.price*shares*0.1,costDebt:0.085,debtWeight:0.20},
      assumptions:{beta:1.0,riskFree:0.069,erp:0.065,ebitMargin:0.14,taxRate:0.25,reinvestRate:0.35,revGrowth:0.12,fadeYears:8,terminalGrowth:0.055},series};
  }
}

/* ─── VALUATION ENGINES ─────────────────────────────────────────────────── */
function ke(a){return a.riskFree+a.beta*a.erp;}

function buildRIRows(co,a){
  const Ke=ke(a),bvps0=co.equity/co.shares,ret=1-a.payout,N=Math.max(3,Math.round(a.fadeYears));
  let bv=bvps0,pvSum=0;const rows=[];
  for(let t=1;t<=N;t++){
    const roe=a.forecastRoe+(a.terminalRoe-a.forecastRoe)*(t/N);
    const eps=roe*bv,dps=eps*a.payout,ri=(roe-Ke)*bv,disc=Math.pow(1+Ke,t),pvRi=ri/disc;
    pvSum+=pvRi;
    rows.push({t,bv:bv,roe,eps,dps,ri,disc,pvRi,cumPv:pvSum});
    bv=bv*(1+roe*ret);
  }
  const riN=(a.terminalRoe-Ke)*bv,tvRaw=a.terminalGrowth<Ke?riN/(Ke-a.terminalGrowth):0;
  const tvPv=tvRaw/Math.pow(1+Ke,N);
  const intrinsic=bvps0+pvSum+tvPv;
  return{rows,bvps0,pvExplicit:pvSum,tvRaw,tvPv,intrinsic,Ke,method:"Residual Income (Excess Return)",N};
}

function buildFCFFRows(co,a){
  const Ke=ke(a),dw=a.debtWeight||co.fcff?.debtWeight||0.20,cd=a.costDebt||co.fcff?.costDebt||0.085;
  const ew=1-dw,WACC=ew*Ke+dw*cd*(1-a.taxRate);
  const N=Math.max(3,Math.round(a.fadeYears));
  let rev=co.fcff?.revenue||co.equity*2,pvSum=0;const rows=[];
  for(let t=1;t<=N;t++){
    const g=a.revGrowth+(a.terminalGrowth-a.revGrowth)*(t/N);
    rev=rev*(1+g);
    const ebit=rev*a.ebitMargin,tax=ebit*a.taxRate,nopat=ebit-tax,reinv=nopat*a.reinvestRate,fcff=nopat-reinv;
    const disc=Math.pow(1+WACC,t),pvFcff=fcff/disc;
    pvSum+=pvFcff;
    rows.push({t,rev,g,ebit,tax,nopat,reinv,fcff,disc,pvFcff,cumPv:pvSum});
  }
  const fcffN=rows[N-1].fcff*(1+a.terminalGrowth),tvRaw=a.terminalGrowth<WACC?fcffN/(WACC-a.terminalGrowth):0;
  const tvPv=tvRaw/Math.pow(1+WACC,N),ev=pvSum+tvPv;
  const netDebt=co.fcff?.netDebt||0,equityVal=ev-netDebt,intrinsic=equityVal/co.shares;
  return{rows,pvExplicit:pvSum,tvRaw,tvPv,ev,netDebt,equityVal,intrinsic,Ke,WACC,method:"FCFF DCF",N,rev0:co.fcff?.revenue||co.equity*2};
}

function valuate(co,a){return co.type==="financial"?buildRIRows(co,a):buildFCFFRows(co,a);}

function sensitivity(co,a){
  const rd=[-0.01,-0.005,0,0.005,0.01],gd=[-0.01,-0.005,0,0.005,0.01];
  const grid=rd.map(r=>gd.map(g=>valuate(co,{...a,terminalGrowth:a.terminalGrowth+g,riskFree:a.riskFree+r}).intrinsic));
  return{rd,gd,grid};
}

/* ─── FINANCIAL STATEMENTS (projected) ──────────────────────────────────── */
function buildStatements(co,a,vRows){
  const isF=co.type==="financial";
  const FY0=2025,years=[FY0,...vRows.rows.map(r=>FY0+r.t)];
  if(!isF){
    const rows=vRows.rows;
    const pl=years.map((y,i)=>{
      if(i===0){
        const rev=co.fcff?.revenue||co.equity*2;
        const ebit=rev*a.ebitMargin,tax=ebit*a.taxRate,pat=ebit-tax;
        return{y,rev,ebit,tax,pat,ebitMargin:a.ebitMargin};
      }
      const r=rows[i-1];
      return{y,rev:r.rev,ebit:r.ebit,tax:r.tax,pat:r.nopat,ebitMargin:a.ebitMargin};
    });
    const bs=years.map((y,i)=>{
      const prev=i===0?co.equity:co.equity*(1+a.revGrowth*i*0.5);
      const equity=co.equity+pl.slice(0,i+1).reduce((s,r)=>s+(r.pat||0),0)*0.4;
      const debt=(co.fcff?.netDebt||0)+i*pl[Math.max(0,i-1)].pat*a.reinvestRate*0.5;
      return{y,equity:Math.max(equity,co.equity),debt:Math.max(debt,0),totalAssets:equity+debt};
    });
    const cf=years.map((y,i)=>{
      if(i===0)return{y,cfo:pl[0].pat*(1+a.reinvestRate),capex:-pl[0].pat*a.reinvestRate,fcf:pl[0].pat};
      const r=rows[i-1];
      return{y,cfo:r.nopat+r.reinv*0.3,capex:-r.reinv,fcf:r.fcff};
    });
    return{pl,bs,cf};
  }else{
    const bvps0=co.equity/co.shares;
    const pl=years.map((y,i)=>{
      if(i===0){const pat=co.netProfit||co.equity*0.15;return{y,nim:co.nbfc?.nim||0.09,nii:co.nbfc?.aum*(co.nbfc?.nim||0.09),provisions:co.nbfc?.aum*(co.nbfc?.gnpa||0.02)*0.5,pat,roe:pat/co.equity};}
      const r=vRows.rows[i-1];
      const bv=r.bv*co.shares,pat=r.eps*co.shares;
      return{y,nim:co.nbfc?.nim||0.09,nii:bv*(co.nbfc?.nim||0.09)*1.1,provisions:bv*(co.nbfc?.gnpa||0.02)*0.4,pat,roe:r.roe};
    });
    const bs=years.map((y,i)=>{
      const bv=i===0?co.equity:vRows.rows[i-1].bv*co.shares;
      return{y,equity:bv,borrowings:bv*(1/((co.nbfc?.crar||0.18))-1),totalAssets:bv/((co.nbfc?.crar||0.18))};
    });
    const cf=years.map((y,i)=>{
      const pat=pl[i].pat;
      return{y,pat,div:pat*a.payout,retained:pat*(1-a.payout)};
    });
    return{pl,bs,cf};
  }
}

/* ─── FUNDAMENTALS + TECHNICALS + RECOMMEND ─────────────────────────────── */
function fundamentals(co){
  const bvps=co.equity/co.shares,eps=co.netProfit?co.netProfit/co.shares:null;
  return{bvps,eps,pb:co.price/bvps,pe:eps?co.price/eps:null,roe:co.netProfit?co.netProfit/co.equity:null};
}
function sma(arr,n){return arr.map((d,i)=>{if(i<n-1)return{...d,[`sma${n}`]:null};let s=0;for(let j=i-n+1;j<=i;j++)s+=arr[j].close;return{...d,[`sma${n}`]:+(s/n).toFixed(1)};});}
function rsiCalc(arr,n=14){let g=0,l=0;for(let i=1;i<=n;i++){const c=arr[i].close-arr[i-1].close;if(c>=0)g+=c;else l-=c;}let ag=g/n,al=l/n;for(let i=n+1;i<arr.length;i++){const c=arr[i].close-arr[i-1].close;ag=(ag*(n-1)+Math.max(c,0))/n;al=(al*(n-1)+Math.max(-c,0))/n;}return al===0?100:100-100/(1+ag/al);}
function technicals(co){let s=sma(co.series,20);s=sma(s,50);const last=s[s.length-1];return{data:s,rsi:rsiCalc(co.series),hi:Math.max(...co.series.map(d=>d.close)),lo:Math.min(...co.series.map(d=>d.close)),last:last.close,aboveSMA50:last.sma50?last.close>last.sma50:false,aboveSMA20:last.sma20?last.close>last.sma20:false};}
function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x));}
function safe(v,d=0){return v??d;}
function recommend(co,a){
  const v=valuate(co,a),f=fundamentals(co),t=technicals(co),mos=(v.intrinsic-co.price)/co.price;
  const reasons=[];
  reasons.push({label:"Valuation",score:clamp(50+mos*100,0,100),note:`${pct(mos)} MoS vs intrinsic ${inr(v.intrinsic)}`,good:mos>0.1,bad:mos<-0.1});
  let quality,qnote;
  if(co.type==="financial"){
    quality=0.5*clamp((safe(f.roe,0.12)-0.10)/0.15*100,0,100)+0.3*clamp((0.05-safe(co.nbfc?.gnpa,0.03))/0.05*100,0,100)+0.2*clamp((safe(co.nbfc?.crar,0.18)-0.15)/0.15*100,0,100);
    qnote=`ROE ${pct(f.roe)}, GNPA ${pct(safe(co.nbfc?.gnpa,0.03),2)}, CRAR ${pct(safe(co.nbfc?.crar,0.18))}`;
  }else{
    quality=0.45*clamp((safe(f.roe,0.12)-0.10)/0.15*100,0,100)+0.35*clamp(safe(a.ebitMargin,0.12)/0.20*100,0,100)+0.2*clamp((0.3-safe(a.debtWeight||co.fcff?.debtWeight,0.20))/0.3*100,0,100);
    qnote=`ROE ${pct(f.roe)}, EBIT margin ${pct(safe(a.ebitMargin,0.12))}`;
  }
  reasons.push({label:"Quality",score:quality,note:qnote,good:quality>60,bad:quality<40});
  let mom=50;if(t.aboveSMA50)mom+=18;if(t.aboveSMA20)mom+=10;if(t.rsi>70)mom-=15;if(t.rsi<30)mom+=8;mom=clamp(mom,0,100);
  reasons.push({label:"Momentum",score:mom,note:`${t.aboveSMA50?"Above":"Below"} 50-DMA, RSI ${fmt(t.rsi)}`,good:t.aboveSMA50,bad:!t.aboveSMA50});
  let risk=0,flags=[];
  if(co.type==="financial"){if(safe(co.nbfc?.gnpa,0.03)>0.04){risk+=25;flags.push("Elevated GNPA");}if(safe(co.nbfc?.crar,0.18)<0.16){risk+=20;flags.push("Thin CRAR");}}
  else{if(safe(a.debtWeight||co.fcff?.debtWeight,0.20)>0.4){risk+=25;flags.push("High leverage");}}
  if(mos<-0.25){risk+=15;flags.push("Trading above intrinsic");}
  const rs=100-clamp(risk,0,100);
  reasons.push({label:"Risk",score:rs,note:flags.length?flags.join(", "):"No major flags",good:flags.length===0,bad:flags.length>=2});
  const composite=0.45*reasons[0].score+0.28*quality+0.14*mom+0.13*rs;
  return{v,f,t,mos,reasons,composite,verdict:composite>=65?"BUY":composite>=45?"HOLD":"AVOID"};
}

/* ─── UI PRIMITIVES ─────────────────────────────────────────────────────── */
function VerdictBadge({verdict,big}){const col=verdict==="BUY"?C.green:verdict==="HOLD"?C.gold:C.red;return<span style={{...mono,color:col,border:`1px solid ${col}55`,background:col+"14",padding:big?"6px 16px":"2px 9px",borderRadius:6,fontSize:big?15:11,letterSpacing:"0.08em",fontWeight:600}}>{verdict}</span>;}
function Stat({label,value,sub,color}){return<div style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"12px 14px"}}><div style={{...sans,color:C.dim,fontSize:11,letterSpacing:"0.04em",textTransform:"uppercase"}}>{label}</div><div style={{...mono,color:color||C.text,fontSize:20,marginTop:4}}>{value}</div>{sub&&<div style={{...sans,color:C.faint,fontSize:11,marginTop:2}}>{sub}</div>}</div>;}
function Field({label,value,onChange,step=0.005,suffix="%",scale=100,min,max}){return<div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}><span style={{...sans,color:C.dim,fontSize:12}}>{label}</span><span style={{...mono,color:C.gold,fontSize:13}}>{suffix==="%"?(value*scale).toFixed(2):value.toFixed(2)}{suffix}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} style={{width:"100%",accentColor:C.gold,cursor:"pointer"}}/></div>;}
function SectionHeader({title,sub}){return<div style={{marginBottom:16}}><div style={{...sans,color:C.text,fontSize:15,fontWeight:600}}>{title}</div>{sub&&<div style={{...sans,color:C.faint,fontSize:12,marginTop:2}}>{sub}</div>}</div>;}

/* ─── TABLE HELPERS ─────────────────────────────────────────────────────── */
function TableHeader({cols}){return<tr style={{background:C.panel2,borderBottom:`1px solid ${C.line}`}}>{cols.map((c,i)=><th key={i} style={{...sans,color:C.dim,fontSize:11,fontWeight:500,textAlign:i===0?"left":"right",padding:"9px 12px",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:"0.04em"}}>{c}</th>)}</tr>;}
function TableRow({cells,highlight,bold,color,bg}){return<tr style={{borderTop:`1px solid ${C.line}22`,background:bg||"transparent"}}>{cells.map((c,i)=><td key={i} style={{...mono,fontSize:12,padding:"8px 12px",textAlign:i===0?"left":"right",color:color||(i===0?C.dim:C.text),fontWeight:bold?"600":"400",background:highlight&&i>0?C.gold+"18":"transparent"}}>{c}</td>)}</tr>;}
function Table({children,style}){return<div style={{overflowX:"auto",...style}}><table style={{width:"100%",borderCollapse:"collapse",background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,overflow:"hidden"}}>{children}</table></div>;}

/* ─── DCF MODEL VIEW ─────────────────────────────────────────────────────── */
function DCFModel({co,a,set,price,setPrice}){
  const isF=co.type==="financial";
  const v=valuate(co,a);
  const mos=(v.intrinsic-price)/price;
  const sens=useMemo(()=>sensitivity(co,a),[co,a]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* Assumptions + Output side by side */}
      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:18,alignItems:"start"}}>

        {/* Inputs */}
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:18}}>
          <div style={{...sans,color:C.text,fontSize:14,fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",gap:7}}><CircleDollarSign size={16} color={C.gold}/>Assumptions</div>
          <div style={{marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${C.line}`}}>
            <div style={{...sans,color:C.dim,fontSize:11,marginBottom:4}}>Market price (₹)</div>
            <input type="number" value={price} onChange={e=>setPrice(parseFloat(e.target.value)||0)} style={{...mono,width:"100%",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:6,color:C.text,padding:"7px 10px",fontSize:14,outline:"none"}}/>
          </div>
          <div style={{...sans,color:C.goldDim,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Cost of equity (CAPM)</div>
          <Field label="Risk-free rate (10Y G-Sec)" value={a.riskFree} onChange={set("riskFree")} min={0.04} max={0.10}/>
          <Field label="Beta" value={a.beta} onChange={set("beta")} suffix="" min={0.5} max={1.8} step={0.05}/>
          <Field label="Equity risk premium" value={a.erp} onChange={set("erp")} min={0.03} max={0.09}/>
          <div style={{...sans,color:C.goldDim,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",margin:"14px 0 8px"}}>{isF?"Excess-return drivers":"FCFF drivers"}</div>
          {isF?<>
            <Field label="Forecast ROE (yr 1)" value={a.forecastRoe} onChange={set("forecastRoe")} min={0.08} max={0.30}/>
            <Field label="Terminal ROE" value={a.terminalRoe} onChange={set("terminalRoe")} min={0.08} max={0.22}/>
            <Field label="Dividend payout" value={a.payout} onChange={set("payout")} min={0} max={0.6}/>
          </>:<>
            <Field label="Revenue growth (yr 1)" value={a.revGrowth} onChange={set("revGrowth")} min={0.02} max={0.25}/>
            <Field label="EBIT margin" value={a.ebitMargin} onChange={set("ebitMargin")} min={0.04} max={0.35}/>
            <Field label="Tax rate" value={a.taxRate} onChange={set("taxRate")} min={0.15} max={0.35}/>
            <Field label="Reinvestment rate" value={a.reinvestRate} onChange={set("reinvestRate")} min={0.10} max={0.70}/>
          </>}
          <Field label="Fade horizon (years)" value={a.fadeYears} onChange={set("fadeYears")} suffix="" min={3} max={12} step={1}/>
          <Field label="Terminal growth rate" value={a.terminalGrowth} onChange={set("terminalGrowth")} min={0.02} max={0.08}/>
        </div>

        {/* Valuation Bridge */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Output summary */}
          <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{...sans,color:C.text,fontSize:14,fontWeight:600}}>{v.method}</div>
                <div style={{...mono,color:C.faint,fontSize:12,marginTop:2}}>
                  {isF?`Ke = ${pct(v.Ke)}`:`Ke = ${pct(v.Ke)}  ·  WACC = ${pct(v.WACC)}`}
                </div>
              </div>
              <VerdictBadge verdict={mos>=0.15?"BUY":mos>=-0.15?"HOLD":"AVOID"} big/>
            </div>

            {/* Value bridge */}
            <div style={{background:C.panel2,borderRadius:8,padding:14,marginBottom:14}}>
              <div style={{...sans,color:C.dim,fontSize:11,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.04em"}}>Valuation bridge (per share)</div>
              {isF?<>
                <BridgeRow label="Book value / share (t=0)" value={inr(v.bvps0)} color={C.text}/>
                <BridgeRow label={`+ PV of excess returns (${v.N} years)`} value={inr(v.pvExplicit)} color={C.blue}/>
                <BridgeRow label="+ PV of terminal value" value={inr(v.tvPv)} color={C.purple}/>
                <div style={{borderTop:`1px solid ${C.line}`,margin:"8px 0"}}/>
                <BridgeRow label="= Intrinsic value / share" value={inr(v.intrinsic)} color={C.gold} bold/>
                <BridgeRow label="Market price" value={inr(price)} color={C.text}/>
                <BridgeRow label="Margin of safety" value={pct(mos)} color={mos>=0?C.green:C.red} bold/>
              </>:<>
                <BridgeRow label={`PV of explicit FCFFs (${v.N} years)`} value={cr(v.pvExplicit)} color={C.blue}/>
                <BridgeRow label="+ PV of terminal value" value={cr(v.tvPv)} color={C.purple}/>
                <div style={{borderTop:`1px solid ${C.line}`,margin:"8px 0"}}/>
                <BridgeRow label="= Enterprise value" value={cr(v.ev)} color={C.text} bold/>
                <BridgeRow label="− Net debt" value={cr(v.netDebt)} color={C.red}/>
                <BridgeRow label="= Equity value" value={cr(v.equityVal)} color={C.text} bold/>
                <BridgeRow label={`÷ Shares (${fmt(co.shares,1)} cr)`} value="" color={C.faint}/>
                <div style={{borderTop:`1px solid ${C.line}`,margin:"8px 0"}}/>
                <BridgeRow label="= Intrinsic value / share" value={inr(v.intrinsic)} color={C.gold} bold/>
                <BridgeRow label="Market price" value={inr(price)} color={C.text}/>
                <BridgeRow label="Margin of safety" value={pct(mos)} color={mos>=0?C.green:C.red} bold/>
              </>}
            </div>

            {/* TV as % of total */}
            <div style={{...sans,color:C.faint,fontSize:12,lineHeight:1.7}}>
              Terminal value = <span style={{color:C.gold}}>{pct((v.tvPv)/(v.pvExplicit+v.tvPv))}</span> of total value.
              {isF?" Model: book value + sum of discounted excess returns (Ke-ROE) × equity."
                  :" Model: FCFF = NOPAT × (1 − reinvestment rate) discounted at WACC."}
            </div>
          </div>

          {/* Sensitivity table */}
          <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:18}}>
            <SectionHeader title="Sensitivity — intrinsic value (₹)" sub="Rows: Δ discount rate  ·  Columns: Δ terminal growth"/>
            <div style={{overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>
                  <th style={{...mono,color:C.faint,padding:"6px 10px",fontSize:11}}>Δr \ Δg</th>
                  {sens.gd.map((g,i)=><th key={i} style={{...mono,color:C.dim,padding:"6px 10px",textAlign:"center",fontSize:11}}>{(g*100>=0?"+":"")+(g*100).toFixed(1)}%</th>)}
                </tr></thead>
                <tbody>{sens.grid.map((row,ri)=>(
                  <tr key={ri}><td style={{...mono,color:C.dim,padding:"6px 10px",fontSize:11}}>{(sens.rd[ri]*100>=0?"+":"")+(sens.rd[ri]*100).toFixed(1)}%</td>
                  {row.map((val,ci)=>{const center=ri===2&&ci===2,up=val>price;return<td key={ci} style={{...mono,fontSize:12,padding:"7px 8px",textAlign:"center",color:center?C.gold:up?C.green:C.red,background:center?C.gold+"18":"transparent",border:center?`1px solid ${C.gold}55`:`1px solid ${C.line}22`,fontWeight:center?600:400}}>{fmt(val)}</td>;})}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{...sans,color:C.faint,fontSize:11,marginTop:8}}>Base case (centre) = {inr(v.intrinsic)}. Green = undervalued vs {inr(price)}.</div>
          </div>
        </div>
      </div>

      {/* Year-by-year projection table */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:18}}>
        <SectionHeader
          title={isF?"Year-by-Year Residual Income Schedule":"Year-by-Year FCFF Projection"}
          sub={isF?"How book value compounds and excess returns accumulate to intrinsic value"
                  :"How revenue, margins and reinvestment drive free cash flows"}/>
        {isF?<RITable v={v} a={a}/>:<FCFFTable v={v} a={a}/>}
      </div>

    </div>
  );
}

function BridgeRow({label,value,color,bold}){
  return<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
    <span style={{...sans,color:bold?C.text:C.dim,fontSize:12,fontWeight:bold?600:400}}>{label}</span>
    <span style={{...mono,color:color||C.text,fontSize:13,fontWeight:bold?600:400}}>{value}</span>
  </div>;
}

function RITable({v,a}){
  return<Table>
    <thead><TableHeader cols={["Year","BV/sh (begin)","ROE","EPS/sh","DPS/sh","Excess Return","Discount Factor","PV(Excess Ret)","Cum PV"]}/></thead>
    <tbody>
      <TableRow cells={["Base",inr(v.bvps0),"—","—","—","—","—","—","—"]} color={C.faint}/>
      {v.rows.map((r,i)=><TableRow key={i}
        cells={[`Yr ${r.t}`,inr(r.bv),pct(r.roe,1),inr(r.eps,1),inr(r.dps,1),inr(r.ri,1),r.disc.toFixed(3),inr(r.pvRi,1),inr(r.cumPv,1)]}
        highlight={false} bg={i%2===0?C.panel2+"80":"transparent"}/>)}
      <TableRow cells={["Terminal","—","→ "+pct(a.terminalRoe,1),"—","—",inr(v.tvRaw,1),"→ ∞",inr(v.tvPv,1),"—"]} bold bg={C.purple+"18"}/>
      <TableRow cells={["","BV₀ = "+inr(v.bvps0),"","","","Sum(PV) = "+inr(v.pvExplicit,1),"","TV_PV = "+inr(v.tvPv,1),"= "+inr(v.intrinsic)]} bold color={C.gold}/>
    </tbody>
  </Table>;
}

function FCFFTable({v,a}){
  return<Table>
    <thead><TableHeader cols={["Year","Revenue (cr)","Growth","EBIT (cr)","Tax (cr)","NOPAT (cr)","Reinvestment","FCFF (cr)","Discount","PV(FCFF)","Cum PV"]}/></thead>
    <tbody>
      {v.rows.map((r,i)=><TableRow key={i}
        cells={[`Yr ${r.t}`,cr(r.rev,0),pct(r.g,1),cr(r.ebit,0),cr(r.tax,0),cr(r.nopat,0),cr(r.reinv,0),cr(r.fcff,0),r.disc.toFixed(3),cr(r.pvFcff,0),cr(r.cumPv,0)]}
        highlight={false} bg={i%2===0?C.panel2+"80":"transparent"}/>)}
      <TableRow cells={["Terminal","—","→ "+pct(a.terminalGrowth,1),"—","—","—","—",cr(v.rows[v.N-1]?.fcff*(1+a.terminalGrowth),0),"→ ∞",cr(v.tvPv,0),"—"]} bold bg={C.purple+"18"}/>
      <TableRow cells={["","","","","","","Σ PV(FCFF)="+cr(v.pvExplicit,0),"","","TV="+cr(v.tvPv,0),"EV="+cr(v.ev,0)]} bold color={C.gold}/>
    </tbody>
  </Table>;
}

/* ─── FINANCIAL STATEMENTS VIEW ─────────────────────────────────────────── */
function FinancialStatements({co,a}){
  const [activeStmt,setActiveStmt]=useState("pl");
  const v=valuate(co,a);
  const stmts=buildStatements(co,a,v);
  const isF=co.type==="financial";
  const StmtTab=({id,label})=><button onClick={()=>setActiveStmt(id)} style={{...sans,background:activeStmt===id?C.gold+"22":"transparent",border:`1px solid ${activeStmt===id?C.gold+"55":C.line}`,color:activeStmt===id?C.gold:C.dim,padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:500,cursor:"pointer"}}>{label}</button>;

  return<div>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <StmtTab id="pl" label={isF?"P&L Statement":"Income Statement"}/>
      <StmtTab id="bs" label="Balance Sheet"/>
      <StmtTab id="cf" label="Cash Flow"/>
    </div>
    {activeStmt==="pl"&&<PLStatement stmts={stmts} isF={isF}/>}
    {activeStmt==="bs"&&<BSStatement stmts={stmts} isF={isF}/>}
    {activeStmt==="cf"&&<CFStatement stmts={stmts} isF={isF}/>}
    <div style={{...sans,color:C.faint,fontSize:11,marginTop:14,display:"flex",gap:6,alignItems:"center"}}>
      <Info size={13} color={C.goldDim}/>
      <span>FY{stmts.pl[0].y} = actuals (from annual report). FY{stmts.pl[1].y}+ = model projections based on your assumptions. Replace FY{stmts.pl[0].y} with audited figures for accuracy.</span>
    </div>
  </div>;
}

function PLStatement({stmts,isF}){
  const {pl}=stmts;
  const yrs=pl.map(r=>`FY${r.y}`);
  return<div>
    <div style={{...sans,color:C.dim,fontSize:11,marginBottom:10}}>All figures in ₹ crore · FY2025 = last reported actuals · FY2026+ = projections</div>
    <Table>
      <thead><TableHeader cols={["Line Item",...yrs]}/></thead>
      <tbody>
        {isF?<>
          <TableRow cells={["Net Interest Income",...pl.map(r=>cr(r.nii,0))]} bg={C.panel2+"80"}/>
          <TableRow cells={["NIM",...pl.map(r=>pct(r.nim,1))]}/>
          <TableRow cells={["Provisions",...pl.map(r=>cr(-r.provisions,0))]}/>
          <TableRow cells={["Pre-tax profit",...pl.map(r=>cr(r.nii-r.provisions,0))]} bg={C.panel2+"80"}/>
          <TableRow cells={["PAT",...pl.map(r=>cr(r.pat,0))]} bold color={C.green}/>
          <TableRow cells={["ROE",...pl.map(r=>pct(r.roe,1))]}/>
        </>:<>
          <TableRow cells={["Revenue",...pl.map(r=>cr(r.rev,0))]} bg={C.panel2+"80"}/>
          <TableRow cells={["EBIT",...pl.map(r=>cr(r.ebit,0))]}/>
          <TableRow cells={["EBIT Margin",...pl.map(r=>pct(r.ebitMargin,1))]}/>
          <TableRow cells={["Tax",...pl.map(r=>cr(-r.tax,0))]}/>
          <TableRow cells={["PAT / NOPAT",...pl.map(r=>cr(r.pat,0))]} bold color={C.green} bg={C.panel2+"80"}/>
        </>}
      </tbody>
    </Table>
    <RevenueChart pl={pl} isF={isF}/>
  </div>;
}

function BSStatement({stmts,isF}){
  const {bs}=stmts;
  const yrs=bs.map(r=>`FY${r.y}`);
  return<Table>
    <thead><TableHeader cols={["Line Item",...yrs]}/></thead>
    <tbody>
      {isF?<>
        <TableRow cells={["Equity / Net Worth",...bs.map(r=>cr(r.equity,0))]} bold color={C.green} bg={C.panel2+"80"}/>
        <TableRow cells={["Borrowings",...bs.map(r=>cr(r.borrowings,0))]}/>
        <TableRow cells={["Total Assets (AUM)",...bs.map(r=>cr(r.totalAssets,0))]}/>
        <TableRow cells={["Capital Adequacy",...bs.map((_,i)=>i===0?"—":pct(r=>r))]} bg={C.panel2+"80"}/>
      </>:<>
        <TableRow cells={["Shareholders' Equity",...bs.map(r=>cr(r.equity,0))]} bold color={C.green} bg={C.panel2+"80"}/>
        <TableRow cells={["Net Debt",...bs.map(r=>cr(r.debt,0))]}/>
        <TableRow cells={["Total Assets",...bs.map(r=>cr(r.totalAssets,0))]}/>
        <TableRow cells={["Debt/Equity",...bs.map(r=>r.equity>0?fmt(r.debt/r.equity,2)+"x":"—")]} bg={C.panel2+"80"}/>
      </>}
    </tbody>
  </Table>;
}

function CFStatement({stmts,isF}){
  const {cf}=stmts;
  const yrs=cf.map(r=>`FY${r.y}`);
  return<Table>
    <thead><TableHeader cols={["Line Item",...yrs]}/></thead>
    <tbody>
      {isF?<>
        <TableRow cells={["PAT",...cf.map(r=>cr(r.pat,0))]} bg={C.panel2+"80"}/>
        <TableRow cells={["Dividends paid",...cf.map(r=>cr(-r.div,0))]} color={C.red}/>
        <TableRow cells={["Retained earnings",...cf.map(r=>cr(r.retained,0))]} bold color={C.green}/>
      </>:<>
        <TableRow cells={["Operating CF (est.)",...cf.map(r=>cr(r.cfo,0))]} bg={C.panel2+"80"}/>
        <TableRow cells={["Capex / Reinvestment",...cf.map(r=>cr(r.capex,0))]} color={C.red}/>
        <TableRow cells={["Free Cash Flow (FCFF)",...cf.map(r=>cr(r.fcf,0))]} bold color={C.green}/>
      </>}
    </tbody>
  </Table>;
}

function RevenueChart({pl,isF}){
  const data=pl.map(r=>({year:`FY${r.y}`,value:isF?r.pat:r.rev,pat:r.pat}));
  return<div style={{marginTop:16,background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,padding:"14px 8px 8px 0"}}>
    <div style={{...sans,color:C.dim,fontSize:12,padding:"0 0 8px 16px"}}>{isF?"PAT trend (₹ cr)":"Revenue trend (₹ cr)"} — FY2025 actual + projections</div>
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{top:5,right:20,bottom:5,left:0}}>
        <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false}/>
        <XAxis dataKey="year" tick={{fill:C.faint,fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={{stroke:C.line}}/>
        <YAxis tick={{fill:C.faint,fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={{stroke:C.line}} width={55}/>
        <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:6,fontFamily:"monospace",fontSize:12}} labelStyle={{color:C.dim}} formatter={v=>[cr(v)]}/>
        <Bar dataKey="value" fill={C.gold} radius={[3,3,0,0]} name={isF?"PAT":"Revenue"}/>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

/* ─── TECHNICALS VIEW ────────────────────────────────────────────────────── */
function Technical({rec}){
  const t=rec.t;
  return<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:14}}>
      <Stat label="Last close" value={inr(t.last)}/>
      <Stat label="RSI (14)" value={fmt(t.rsi)} color={t.rsi>70?C.red:t.rsi<30?C.green:C.text} sub={t.rsi>70?"Overbought":t.rsi<30?"Oversold":"Neutral"}/>
      <Stat label="Vs 50-DMA" value={t.aboveSMA50?"Above":"Below"} color={t.aboveSMA50?C.green:C.red}/>
      <Stat label="52w High" value={inr(t.hi)}/>
      <Stat label="52w Low" value={inr(t.lo)}/>
    </div>
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"16px 8px 8px 0"}}>
      <div style={{...sans,color:C.dim,fontSize:12,padding:"0 0 8px 16px"}}>Price · 20-DMA · 50-DMA (1 year)</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={t.data} margin={{top:5,right:20,bottom:5,left:0}}>
          <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false}/>
          <XAxis dataKey="i" tick={{fill:C.faint,fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={{stroke:C.line}}/>
          <YAxis domain={["auto","auto"]} tick={{fill:C.faint,fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={{stroke:C.line}} width={55}/>
          <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:6,fontFamily:"monospace",fontSize:12}} labelStyle={{color:C.dim}}/>
          <Line type="monotone" dataKey="close" stroke={C.gold} dot={false} strokeWidth={1.6} name="Price"/>
          <Line type="monotone" dataKey="sma20" stroke={C.blue} dot={false} strokeWidth={1.1} name="20-DMA"/>
          <Line type="monotone" dataKey="sma50" stroke={C.dim} dot={false} strokeWidth={1.1} strokeDasharray="4 3" name="50-DMA"/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>;
}

/* ─── FUNDAMENTALS VIEW ──────────────────────────────────────────────────── */
function Fundamentals({co,f}){
  const isF=co.type==="financial";
  const cards=isF?[
    ["Net worth",cr(co.equity)],["Net profit",co.netProfit?cr(co.netProfit):"—"],["BV/share",inr(f.bvps)],["EPS",f.eps?inr(f.eps):"—"],["ROE",pct(f.roe)],["ROA",pct(safe(co.nbfc?.roa,0.02),2)],["AUM",cr(safe(co.nbfc?.aum,0))],["NIM",pct(safe(co.nbfc?.nim,0.09))],["GNPA",pct(safe(co.nbfc?.gnpa,0.03),2)],["NNPA",pct(safe(co.nbfc?.nnpa,0.015),2)],["CRAR",pct(safe(co.nbfc?.crar,0.18))],["P/B",fmt(f.pb,2)]
  ]:[
    ["Revenue",cr(co.fcff?.revenue)],["EBIT margin",pct(safe(co.assumptions?.ebitMargin,0.12))],["Net debt",cr(co.fcff?.netDebt)],["BV/share",inr(f.bvps)],["EPS",f.eps?inr(f.eps):"—"],["P/E",f.pe?fmt(f.pe,1):"—"],["ROE",pct(f.roe)],["P/B",fmt(f.pb,2)]
  ];
  return<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
      {cards.map(([l,v])=><div key={l} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,padding:"12px 14px"}}>
        <div style={{...sans,color:C.dim,fontSize:11}}>{l}</div>
        <div style={{...mono,color:C.text,fontSize:17,marginTop:4}}>{v}</div>
      </div>)}
    </div>
  </div>;
}

/* ─── VERDICT VIEW ───────────────────────────────────────────────────────── */
function Verdict({rec}){
  return<div style={{display:"grid",gap:16}}>
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:12}}>
        <div style={{...serif,color:C.text,fontSize:20,fontWeight:600}}>How the verdict is built</div>
        <VerdictBadge verdict={rec.verdict} big/>
      </div>
      <div style={{...sans,color:C.dim,fontSize:13,marginBottom:18}}>Composite = 45% valuation + 28% quality + 14% momentum + 13% risk. Score {fmt(rec.composite)}/100.</div>
      {rec.reasons.map(r=><div key={r.label} style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
          <span style={{...sans,color:C.text,fontSize:13,fontWeight:500}}>{r.label}</span>
          <span style={{...mono,color:r.good?C.green:r.bad?C.red:C.text,fontSize:13}}>{fmt(r.score)}/100</span>
        </div>
        <div style={{height:6,background:C.panel2,borderRadius:3,overflow:"hidden",border:`1px solid ${C.line}`}}>
          <div style={{width:`${r.score}%`,height:"100%",background:r.good?C.green:r.bad?C.red:C.gold}}/>
        </div>
        <div style={{...sans,color:C.faint,fontSize:12,marginTop:4}}>{r.note}</div>
      </div>)}
    </div>
    <div style={{background:C.panel,border:`1px solid ${C.goldDim}55`,borderRadius:10,padding:"14px 18px",display:"flex",gap:10,alignItems:"flex-start"}}>
      <ShieldAlert size={16} color={C.gold} style={{flexShrink:0,marginTop:1}}/>
      <div style={{...sans,color:C.dim,fontSize:12,lineHeight:1.65}}><b style={{color:C.text}}>Not investment advice.</b> This shows what a stock is worth under <em>your</em> assumptions. Change the assumptions and the value changes. Publishing buy/sell calls publicly in India may require SEBI Research Analyst registration.</div>
    </div>
  </div>;
}

/* ─── SCREENER ───────────────────────────────────────────────────────────── */
function Screener({companies,onOpen,loading}){
  const [q,setQ]=useState("");
  const [sort,setSort]=useState("composite");
  const [sectorFilter,setSectorFilter]=useState("All");
  const sectors=useMemo(()=>{
    const s=new Set(companies.map(c=>{const sec=(c.sector||"").toLowerCase();
      if(sec.includes("financial")||sec.includes("bank")||sec.includes("nbfc"))return"Financials";
      if(sec.includes("tech")||sec.includes("information"))return"Technology";
      if(sec.includes("pharma")||sec.includes("health"))return"Healthcare";
      if(sec.includes("auto"))return"Auto";
      if(sec.includes("fmcg")||sec.includes("consumer")||sec.includes("retail"))return"Consumer";
      if(sec.includes("energy")||sec.includes("oil")||sec.includes("power"))return"Energy";
      if(sec.includes("metal")||sec.includes("mining"))return"Metals";
      if(sec.includes("chem"))return"Chemicals";
      return"Other";
    }));return["All",...Array.from(s).sort()];
  },[companies]);

  const rows=useMemo(()=>{
    return companies.map(co=>{
      const r=recommend(co,co.assumptions),f=fundamentals(co);return{co,...r,pb:f.pb,pe:f.pe,roe:f.roe};
    }).filter(r=>{
      const mQ=(r.co.name+r.co.ticker).toLowerCase().includes(q.toLowerCase());
      if(sectorFilter==="All")return mQ;
      const sec=(r.co.sector||"").toLowerCase();
      if(sectorFilter==="Financials")return mQ&&(sec.includes("financial")||sec.includes("bank")||sec.includes("nbfc"));
      if(sectorFilter==="Technology")return mQ&&(sec.includes("tech")||sec.includes("information"));
      if(sectorFilter==="Healthcare")return mQ&&(sec.includes("pharma")||sec.includes("health"));
      if(sectorFilter==="Auto")return mQ&&sec.includes("auto");
      if(sectorFilter==="Consumer")return mQ&&(sec.includes("fmcg")||sec.includes("consumer")||sec.includes("retail"));
      if(sectorFilter==="Energy")return mQ&&(sec.includes("energy")||sec.includes("oil")||sec.includes("power"));
      if(sectorFilter==="Metals")return mQ&&(sec.includes("metal")||sec.includes("mining"));
      if(sectorFilter==="Chemicals")return mQ&&sec.includes("chem");
      return mQ;
    }).sort((a,b)=>{
      if(sort==="composite")return b.composite-a.composite;
      if(sort==="mos")return b.mos-a.mos;
      if(sort==="roe")return(b.roe||0)-(a.roe||0);
      if(sort==="price")return b.co.price-a.co.price;
      return a.co.name.localeCompare(b.co.name);
    });
  },[companies,q,sort,sectorFilter]);

  const Th=({children,k})=><th onClick={()=>k&&setSort(k)} style={{...sans,color:sort===k?C.gold:C.dim,fontSize:11,fontWeight:500,textAlign:"right",padding:"10px 12px",textTransform:"uppercase",letterSpacing:"0.04em",cursor:k?"pointer":"default",whiteSpace:"nowrap"}}>{children}</th>;

  return<div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"8px 12px",flex:"1 1 240px"}}>
        <Search size={15} color={C.dim}/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search company or ticker…" style={{...sans,background:"transparent",border:"none",outline:"none",color:C.text,fontSize:14,width:"100%"}}/>
      </div>
      <select value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)} style={{...sans,background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,color:C.text,padding:"8px 12px",fontSize:13,cursor:"pointer",outline:"none"}}>
        {sectors.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{...sans,color:C.faint,fontSize:12}}>{loading?"Loading…":`${rows.length} companies`}</div>
    </div>
    <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",background:C.panel}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{background:C.panel2,borderBottom:`1px solid ${C.line}`}}>
          <tr>
            <th onClick={()=>setSort("name")} style={{...sans,color:sort==="name"?C.gold:C.dim,fontSize:11,fontWeight:500,textAlign:"left",padding:"10px 16px",textTransform:"uppercase",letterSpacing:"0.04em",cursor:"pointer"}}>Company</th>
            <Th k="mos">Price / Intrinsic</Th><Th k="mos">MoS</Th><Th k="roe">ROE</Th><Th>P/B</Th><Th>P/E</Th><Th k="composite">Score</Th><Th>Verdict</Th><th style={{width:30}}></th>
          </tr>
        </thead>
        <tbody>
          {loading?<tr><td colSpan={9} style={{...sans,textAlign:"center",padding:40,color:C.faint}}>Loading live data…</td></tr>
          :rows.map((r,idx)=>(
            <tr key={r.co.ticker||r.co.id} onClick={()=>onOpen(r.co.ticker||r.co.id)} style={{borderTop:idx?`1px solid ${C.line}`:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=C.panel2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"11px 16px"}}><div style={{...sans,color:C.text,fontSize:13,fontWeight:500}}>{r.co.name}</div><div style={{...mono,color:C.faint,fontSize:10}}>{r.co.ticker} · {r.co.sector}</div></td>
              <td style={{...mono,textAlign:"right",padding:"11px 12px",fontSize:12,color:C.text}}>{inr(r.co.price)} <span style={{color:C.faint}}>/</span> <span style={{color:C.gold}}>{inr(r.v.intrinsic)}</span></td>
              <td style={{...mono,textAlign:"right",padding:"11px 12px",fontSize:12,color:r.mos>=0?C.green:C.red}}>{pct(r.mos)}</td>
              <td style={{...mono,textAlign:"right",padding:"11px 12px",fontSize:12,color:C.text}}>{pct(r.roe)}</td>
              <td style={{...mono,textAlign:"right",padding:"11px 12px",fontSize:12,color:C.text}}>{fmt(r.pb,2)}</td>
              <td style={{...mono,textAlign:"right",padding:"11px 12px",fontSize:12,color:C.text}}>{r.pe?fmt(r.pe,1):"—"}</td>
              <td style={{...mono,textAlign:"right",padding:"11px 12px",fontSize:12,color:C.text}}>{fmt(r.composite)}</td>
              <td style={{textAlign:"right",padding:"11px 12px"}}><VerdictBadge verdict={r.verdict}/></td>
              <td style={{textAlign:"center"}}><ChevronRight size={14} color={C.faint}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div style={{marginTop:14,border:`1px solid ${C.line}`,borderRadius:8,background:C.panel,padding:"11px 16px",display:"flex",alignItems:"center",gap:10}}>
      <Database size={14} color={C.gold}/>
      <span style={{...sans,color:C.dim,fontSize:12}}>Live prices from Yahoo Finance · refreshes every 15 mins during market hours · click any row for full DCF model</span>
    </div>
  </div>;
}

/* ─── COMPANY DETAIL ─────────────────────────────────────────────────────── */
function Company({co,assumptions,setAssumptions,price,setPrice,onBack}){
  const [tab,setTab]=useState("dcf");
  const co2={...co,price,assumptions};
  const rec=useMemo(()=>recommend(co2,assumptions),[co2,assumptions]);
  const f=rec.f;
  const set=k=>val=>setAssumptions({...assumptions,[k]:val});

  const Tab=({id,icon:Icon,label})=><button onClick={()=>setTab(id)} style={{...sans,display:"flex",alignItems:"center",gap:6,background:tab===id?C.panel2:"transparent",border:`1px solid ${tab===id?C.line:"transparent"}`,color:tab===id?C.gold:C.dim,padding:"7px 13px",borderRadius:7,fontSize:12.5,fontWeight:500,cursor:"pointer"}}><Icon size={14}/>{label}</button>;

  return<div>
    <button onClick={onBack} style={{...sans,display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",color:C.dim,fontSize:13,cursor:"pointer",marginBottom:14}}>
      <ArrowLeft size={15}/> Back to screener
    </button>

    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,marginBottom:18}}>
      <div>
        <div style={{...serif,color:C.text,fontSize:28,fontWeight:600,lineHeight:1.1}}>{co.name}</div>
        <div style={{...mono,color:C.faint,fontSize:12,marginTop:4}}>{co.ticker} · {co.sector} · {co.type==="financial"?"Residual Income Model":"FCFF DCF Model"}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        <div style={{textAlign:"right"}}>
          <div style={{...sans,color:C.dim,fontSize:10,textTransform:"uppercase",letterSpacing:"0.04em"}}>Composite Score</div>
          <div style={{...mono,color:C.text,fontSize:24}}>{fmt(rec.composite)}<span style={{color:C.faint,fontSize:13}}>/100</span></div>
        </div>
        <VerdictBadge verdict={rec.verdict} big/>
      </div>
    </div>

    {/* Top stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
      <Stat label="Market Price" value={inr(price)}/>
      <Stat label="Intrinsic Value" value={inr(rec.v.intrinsic)} color={C.gold}/>
      <Stat label="Margin of Safety" value={pct(rec.mos)} color={rec.mos>=0?C.green:C.red} sub={rec.mos>=0?"Undervalued":"Overvalued"}/>
      <Stat label="ROE" value={pct(f.roe)}/>
      <Stat label={co.type==="financial"?"P/B":"P/E"} value={co.type==="financial"?fmt(f.pb,2):(f.pe?fmt(f.pe,1):"—")}/>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
      <Tab id="dcf" icon={Calculator} label="DCF Model"/>
      <Tab id="statements" icon={FileText} label="Financial Statements"/>
      <Tab id="fundamentals" icon={BookOpen} label="Fundamentals"/>
      <Tab id="technical" icon={BarChart2} label="Technicals"/>
      <Tab id="verdict" icon={Gauge} label="Verdict"/>
    </div>

    {tab==="dcf"&&<DCFModel co={co2} a={assumptions} set={set} price={price} setPrice={setPrice}/>}
    {tab==="statements"&&<FinancialStatements co={co2} a={assumptions}/>}
    {tab==="fundamentals"&&<Fundamentals co={co2} f={f}/>}
    {tab==="technical"&&<Technical rec={rec}/>}
    {tab==="verdict"&&<Verdict rec={rec}/>}
  </div>;
}

/* ─── ROOT ───────────────────────────────────────────────────────────────── */
export default function App(){
  const API=import.meta.env.VITE_API_URL;
  const [companies,setCompanies]=useState(SEED);
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState("screener");
  const [selectedId,setSelectedId]=useState(null);
  const [assumptions,setAssumptions]=useState(null);
  const [price,setPrice]=useState(0);

  useEffect(()=>{
    if(!API)return;
    setLoading(true);
    fetch(`${API}/api/companies`).then(r=>r.json()).then(rows=>{
      const mapped=rows.map(r=>buildFromApi(r));
      setCompanies(mapped.length>0?mapped:SEED);
    }).catch(()=>setCompanies(SEED)).finally(()=>setLoading(false));
  },[]);

  const selected=useMemo(()=>companies.find(c=>(c.ticker||c.id)===selectedId),[companies,selectedId]);

  const open=id=>{
    const co=companies.find(c=>(c.ticker||c.id)===id);if(!co)return;
    setSelectedId(id);setAssumptions({...co.assumptions});setPrice(co.price);setView("company");
  };

  return<div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
      body{margin:0}*::-webkit-scrollbar{height:7px;width:7px}*::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px}
      input[type=range]{height:4px;border-radius:2px;background:${C.line}}select option{background:${C.panel2}}`}</style>
    <div style={{maxWidth:1280,margin:"0 auto",padding:"22px 20px 80px"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:16,borderBottom:`1px solid ${C.line}`,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,borderRadius:8,background:C.gold+"18",border:`1px solid ${C.gold}55`,display:"flex",alignItems:"center",justifyContent:"center"}}><TrendingUp size={18} color={C.gold}/></div>
          <div>
            <div style={{...serif,fontSize:20,fontWeight:600,color:C.text,lineHeight:1}}>Equity Research Terminal</div>
            <div style={{...mono,fontSize:11,color:C.faint,marginTop:3}}>DCF · statements · technicals · verdict</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {!loading&&<div style={{...sans,fontSize:11,color:C.faint}}>{companies.length} companies</div>}
          <div style={{...sans,fontSize:11,color:C.goldDim,border:`1px solid ${C.goldDim}55`,padding:"4px 10px",borderRadius:20,background:C.gold+"0d"}}>{API?"LIVE DATA":"SAMPLE DATA"}</div>
        </div>
      </header>
      {view==="screener"&&<Screener companies={companies} onOpen={open} loading={loading}/>}
      {view==="company"&&selected&&assumptions&&<Company co={selected} assumptions={assumptions} setAssumptions={setAssumptions} price={price} setPrice={setPrice} onBack={()=>setView("screener")}/>}
    </div>
  </div>;
}
