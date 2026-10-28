/** Embeddable booking button; hosted checkout stays on the merchant's booking page. */
export function mountMagiBooking(target,{bookingUrl,label='Book an appointment'}) {
  if(!target||typeof target.replaceChildren!=='function')throw new TypeError('DOM target required');
  const url=new URL(bookingUrl);
  if(url.origin!=='https://www.magibooking.com'||url.username||url.password||url.search||url.hash||!/^\/book\/[A-Za-z0-9_-]+\/$/.test(url.pathname))throw new TypeError('Use the merchant public https://www.magibooking.com/book/slug/ URL');
  const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.textContent=String(label);link.className='magibooking-button';
  target.replaceChildren(link);
  return {destroy(){link.remove();}};
}
