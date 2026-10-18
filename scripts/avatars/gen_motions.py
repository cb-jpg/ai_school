"""Author the Idle / Talk motion3 files for the rebuilt chibi models (no arm params: the decomposed arm
layers tear when swung, so gestures are head / body / brow / eye driven). usage: gen_motions.py outdir name"""
import json, math, sys
S=math.sin; PI=math.pi
def bump(t,a,b):
    return 0.0 if t<=a or t>=b else S(PI*(t-a)/(b-a))**2
def blinks(times,w=0.24):
    return lambda t: 1.0-max((bump(t,tb,tb+w) for tb in times),default=0.0)
def motion(dur,curves,loop=False,fade=0.5,dt=0.05):
    n=int(round(dur/dt)); cs=[]; segs=0; pts=0
    for cid,fn in curves.items():
        vals=[(round(i*dt,4),round(fn(i*dt),4)) for i in range(n+1)]
        seg=[vals[0][0],vals[0][1]]
        for t,v in vals[1:]: seg+= [0,t,v]
        cs.append({"Target":"Parameter","Id":cid,"FadeInTime":fade,"FadeOutTime":fade,"Segments":seg})
        segs+=n; pts+=n+1
    return {"Version":3,"Meta":{"Duration":dur,"Fps":1/dt,"Loop":loop,"AreBeziersRestricted":True,
            "CurveCount":len(cs),"TotalSegmentCount":segs,"TotalPointCount":pts,"UserDataCount":0,"TotalUserDataSize":0},
            "Curves":cs}
def env(t,dur,e=0.45):  # fade gestures in/out so every motion starts and ends at the rest pose
    return min(1.0,t/e,(dur-t)/e) if 0<t<dur else 0.0
def sm(x): x=max(0,min(1,x)); return x*x*(3-2*x)
def E(t,dur,e=0.45): return sm(env(t,dur,e))
out,name=sys.argv[1],sys.argv[2]
M={}
# ---------------- Idle: quiet, never-repeating-looking life (non-loop so Cubism re-picks a variant)
def idle_a(d=8.0):
    e=lambda t:E(t,d,0.8)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/4-PI/2),
     "ParamAngleX":lambda t:e(t)*3.5*S(2*PI*t/8),
     "ParamAngleY":lambda t:e(t)*(1.5*S(2*PI*t/4+0.6)),
     "ParamAngleZ":lambda t:e(t)*1.8*S(2*PI*t/8+1.0),
     "ParamBodyAngleX":lambda t:e(t)*1.8*S(2*PI*t/8+0.4),
     "ParamBodyAngleY":lambda t:e(t)*1.0*S(2*PI*t/4),
     "ParamEyeLOpen":blinks([2.6,6.2,6.5]),"ParamEyeROpen":blinks([2.6,6.2,6.5])},fade=0.8)
def idle_b(d=9.0):  # curious tilt + glance
    e=lambda t:E(t,d,0.9)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/4.5-PI/2),
     "ParamAngleX":lambda t:e(t)*(-6*bump(t,1.5,5.5)+3*bump(t,5.5,8.5)),
     "ParamAngleY":lambda t:e(t)*(2.5*bump(t,1.5,5.5)),
     "ParamAngleZ":lambda t:e(t)*(5*bump(t,1.5,5.5)-3*bump(t,5.5,8.5)),
     "ParamBodyAngleX":lambda t:e(t)*(-2.5*bump(t,1.5,5.5)),
     "ParamBrowLY":lambda t:e(t)*0.5*bump(t,2.0,5.0),"ParamBrowRY":lambda t:e(t)*0.2*bump(t,2.0,5.0),
     "ParamEyeLOpen":blinks([1.2,5.9]),"ParamEyeROpen":blinks([1.2,5.9])},fade=0.8)
def idle_c(d=7.0):  # content, slight smile + sway
    e=lambda t:E(t,d,0.8)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/3.5-PI/2),
     "ParamAngleX":lambda t:e(t)*4*S(2*PI*t/7+2.0),
     "ParamAngleZ":lambda t:e(t)*2.5*S(2*PI*t/3.5),
     "ParamBodyAngleZ":lambda t:e(t)*1.2*S(2*PI*t/3.5+0.3),
     "ParamBodyAngleX":lambda t:e(t)*2.2*S(2*PI*t/7+2.0),
     "ParamCheek":lambda t:e(t)*0.35*bump(t,1.5,5.5),
     "ParamMouthForm":lambda t:e(t)*0.3*bump(t,1.5,5.5),
     "ParamEyeLOpen":blinks([3.3]),"ParamEyeROpen":blinks([3.3])},fade=0.8)
M["Idle"]=[("idle1",idle_a()),("idle2",idle_b()),("idle3",idle_c())]
# ---------------- Talk: gestures that do NOT touch ParamMouthOpenY (lip-sync owns it)
def nodder(d,times,amp=7):  # emphatic nods
    return lambda t:-amp*max((bump(t,tn,tn+0.55) for tn in times),default=0)
def talk_nod(d=4.0):
    e=lambda t:E(t,d,0.35)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/2.5-PI/2),
     "ParamAngleY":lambda t:e(t)*(nodder(d,[0.7,1.9,3.0])(t)+2.0*S(2*PI*t/2.0)),
     "ParamAngleX":lambda t:e(t)*(3.5*S(2*PI*t/4.0+0.8)),
     "ParamAngleZ":lambda t:e(t)*(2.5*S(2*PI*t/2.0+0.5)),
     "ParamBodyAngleY":lambda t:e(t)*(-1.8*max((bump(t,tn,tn+0.55) for tn in [0.7,1.9,3.0]),default=0)),
     "ParamBodyAngleX":lambda t:e(t)*2.0*S(2*PI*t/4.0),
     "ParamBrowLY":lambda t:e(t)*0.35*bump(t,0.6,1.6),"ParamBrowRY":lambda t:e(t)*0.35*bump(t,0.6,1.6),
     "ParamEyeLOpen":blinks([2.3]),"ParamEyeROpen":blinks([2.3])},fade=0.35)
def talk_tilt(d=4.5):
    e=lambda t:E(t,d,0.4)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/2.5-PI/2),
     "ParamAngleZ":lambda t:e(t)*(7*S(2*PI*t/4.5)+2*S(2*PI*t/1.5)),
     "ParamAngleX":lambda t:e(t)*(-5*S(2*PI*t/4.5+0.4)),
     "ParamAngleY":lambda t:e(t)*(1.5+2.0*S(2*PI*t/2.25)),
     "ParamBodyAngleZ":lambda t:e(t)*2.0*S(2*PI*t/4.5+0.2),
     "ParamBodyAngleX":lambda t:e(t)*(-2.5*S(2*PI*t/4.5+0.4)),
     "ParamCheek":lambda t:e(t)*0.3*bump(t,0.8,3.6),
     "ParamBrowLY":lambda t:e(t)*0.25*bump(t,1.0,2.6),
     "ParamEyeLOpen":blinks([1.4,3.7]),"ParamEyeROpen":blinks([1.4,3.7])},fade=0.4)
def talk_lively(d=3.6):
    e=lambda t:E(t,d,0.3)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/2.0-PI/2),
     "ParamAngleY":lambda t:e(t)*(4.0*S(2*PI*t/1.2)+1.5*S(2*PI*t/0.6)),
     "ParamAngleX":lambda t:e(t)*(5*S(2*PI*t/3.6)),
     "ParamAngleZ":lambda t:e(t)*(4*S(2*PI*t/1.8+1.0)),
     "ParamBodyAngleY":lambda t:e(t)*(2.0*S(2*PI*t/1.2+0.4)),
     "ParamBodyAngleZ":lambda t:e(t)*(1.5*S(2*PI*t/1.8)),
     "ParamBrowLY":lambda t:e(t)*0.5*bump(t,0.3,1.8),"ParamBrowRY":lambda t:e(t)*0.5*bump(t,0.3,1.8),
     "ParamEyeLSmile":lambda t:e(t)*0.55*bump(t,1.0,3.0),"ParamEyeRSmile":lambda t:e(t)*0.55*bump(t,1.0,3.0),
     "ParamCheek":lambda t:e(t)*0.5*bump(t,0.8,3.2),
     "ParamEyeLOpen":blinks([2.9]),"ParamEyeROpen":blinks([2.9])},fade=0.3)
def talk_think(d=5.0):
    e=lambda t:E(t,d,0.5)
    return motion(d,{
     "ParamBreath":lambda t:0.5+0.5*S(2*PI*t/2.5-PI/2),
     "ParamAngleX":lambda t:e(t)*(-9*bump(t,0.6,3.0)+4*bump(t,3.0,4.6)),
     "ParamAngleY":lambda t:e(t)*(5*bump(t,0.6,3.0)-2*bump(t,3.2,4.4)),
     "ParamAngleZ":lambda t:e(t)*(4*bump(t,0.6,3.0)-2*bump(t,3.0,4.6)),
     "ParamBodyAngleX":lambda t:e(t)*(-3*bump(t,0.6,3.0)+1.5*bump(t,3.0,4.6)),
     "ParamBrowLY":lambda t:e(t)*0.6*bump(t,0.8,2.8),"ParamBrowRY":lambda t:e(t)*0.1*bump(t,0.8,2.8),
     "ParamBrowLForm":lambda t:e(t)*-0.3*bump(t,0.8,2.8),
     "ParamEyeLOpen":blinks([0.3,3.4]),"ParamEyeROpen":blinks([0.3,3.4])},fade=0.5)
M["Talk"]=[("talk1",talk_nod()),("talk2",talk_tilt()),("talk3",talk_lively()),("talk4",talk_think())]
import os; os.makedirs(out,exist_ok=True)
index={}
for g,ms in M.items():
    index[g]=[]
    for n,m in ms:
        fn=f"{name}.{n}.motion3.json"; json.dump(m,open(f"{out}/{fn}","w"),separators=(",",":")); index[g].append(fn)
json.dump(index,open(f"{out}/_motion_index.json","w"),indent=1); print(index)
