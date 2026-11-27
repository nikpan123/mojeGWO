// Wyjątki dotyczą wyłącznie statycznego wyglądu, nigdy nawigacji lub wysyłania danych.
export function isVisualAsset(request,environment){
 let url;try{url=new URL(request.url());}catch{return false;}
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||request.method()!=='GET'||request.isNavigationRequest())return false;
 const type=request.resourceType();
 if(url.hostname==='fonts.googleapis.com')return type==='stylesheet';
 if(url.hostname==='fonts.gstatic.com')return type==='font';
 return url.hostname===(environment==='prod'?'files.gwo.pl':'files.gwotest.pl')&&type==='image';
}
