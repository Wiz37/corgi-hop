export const FRAME_W = 366;
export const FRAME_H = 352;
export const FRAME_COUNT = 8;
export const PORTRAIT_SIZE = 256;
export const OUTLINE = '#2a1720';
export interface Pose { x:number; y:number; scale:number; bob:number; tilt:number; frontNear:number; frontFar:number; rearNear:number; rearFar:number; tail:number; }
export const RUN_POSES = [
 {bob:0,tilt:-1.4,frontNear:20,frontFar:-12,rearNear:-19,rearFar:12,tail:-5},
 {bob:-5,tilt:.2,frontNear:11,frontFar:-3,rearNear:-9,rearFar:3,tail:1},
 {bob:-10,tilt:1.7,frontNear:-4,frontFar:15,rearNear:8,rearFar:-16,tail:6},
 {bob:-6,tilt:.6,frontNear:-15,frontFar:7,rearNear:16,rearFar:-8,tail:2},
 {bob:0,tilt:-1.2,frontNear:-20,frontFar:12,rearNear:19,rearFar:-12,tail:-5},
 {bob:-5,tilt:.2,frontNear:-10,frontFar:2,rearNear:9,rearFar:-3,tail:0},
 {bob:-10,tilt:1.7,frontNear:5,frontFar:-15,rearNear:-8,rearFar:16,tail:6},
 {bob:-6,tilt:.6,frontNear:15,frontFar:-7,rearNear:-16,rearFar:8,tail:2},
];
export function path(ctx:CanvasRenderingContext2D,points:Array<[number,number]>,fill:string|CanvasGradient,stroke=OUTLINE,width=4):void{if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
export function curve(ctx:CanvasRenderingContext2D,commands:Array<[string,...number[]]>,fill:string|CanvasGradient,stroke=OUTLINE,width=4):void{ctx.beginPath();for(const c of commands){if(c[0]==='M')ctx.moveTo(c[1],c[2]);else if(c[0]==='L')ctx.lineTo(c[1],c[2]);else if(c[0]==='Q')ctx.quadraticCurveTo(c[1],c[2],c[3],c[4]);else if(c[0]==='C')ctx.bezierCurveTo(c[1],c[2],c[3],c[4],c[5],c[6]);else if(c[0]==='Z')ctx.closePath();}ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
export function ellipse(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient,stroke=OUTLINE,width=4,rotation=0):void{ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
export function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string|CanvasGradient,stroke=OUTLINE,width=4):void{const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.lineTo(x+w-rr,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rr);ctx.lineTo(x+w,y+h-rr);ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);ctx.lineTo(x+rr,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rr);ctx.lineTo(x,y+rr);ctx.quadraticCurveTo(x,y,x+rr,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
export function line(ctx:CanvasRenderingContext2D,points:Array<[number,number]>,color=OUTLINE,width=4):void{if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
export function star(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string,stroke=OUTLINE,width=3):void{const pts:Array<[number,number]>=[];for(let i=0;i<10;i++){const rr=i%2===0?r:r*.43;const a=-Math.PI/2+i*Math.PI/5;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}path(ctx,pts,fill,stroke,width);}
export function grad(ctx:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,colors:Array<[number,string]>):CanvasGradient{const g=ctx.createLinearGradient(x0,y0,x1,y1);for(const [stop,color] of colors)g.addColorStop(stop,color);return g;}
