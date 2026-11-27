const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline=text=>escape(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');

// This view uses the same field instructions as the repository documentation.
export function renderMaterialGuide(markdown,environment){
 const section=markdown.split('<!-- material-fields:start -->')[1]?.split('<!-- material-fields:end -->')[0];
 if(!section)throw new Error('Brak instrukcji pól materiału.');
 const lines=section.trim().split(/\r?\n/),html=[];let list=false,table=false;
 const close=()=>{if(list){html.push('</ol>');list=false;}if(table){html.push('</tbody></table></div>');table=false;}};
 for(const line of lines){
  if(!line.trim()){close();continue;}
  const heading=line.match(/^(#{1,6}) (.+)$/),image=line.match(/^!\[([^\]]*)\]\(images\/([a-z0-9-]+\.png)\)$/),item=line.match(/^\d+\. (.+)$/);
  if(heading){close();const level=heading[1].length===3?1:2;html.push('<h'+level+'>'+inline(heading[2])+'</h'+level+'>');}
  else if(image){close();html.push('<figure><img src="/'+environment+'/instruction/images/'+image[2]+'" alt="'+escape(image[1])+'" loading="lazy"><figcaption>'+escape(image[1])+'</figcaption></figure>');}
  else if(line.startsWith('|')){
   const cells=line.split('|').slice(1,-1).map(cell=>cell.trim());
   if(cells.every(cell=>/^:?-+:?$/.test(cell)))continue;
   if(!table){close();html.push('<div class="table"><table><thead><tr>'+cells.map(cell=>'<th>'+inline(cell)+'</th>').join('')+'</tr></thead><tbody>');table=true;}
   else html.push('<tr>'+cells.map(cell=>'<td>'+inline(cell)+'</td>').join('')+'</tr>');
  }
  else if(item){if(table)close();if(!list){html.push('<ol>');list=true;}html.push('<li>'+inline(item[1])+'</li>');}
  else{close();html.push('<p>'+inline(line)+'</p>');}
 }
 close();
 return '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jak wypełnić pola materiału — moje.gwo</title><link rel="stylesheet" href="/'+environment+'/panel.css"><script src="/'+environment+'/theme.js"></script></head><body data-environment="'+environment+'"><main class="material-guide"><a href="/'+environment+'/#teachers">← Nauczyciele i materiały · '+environment.toUpperCase()+'</a><article>'+html.join('\n')+'</article></main></body></html>';
}
