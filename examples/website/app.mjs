import {mountMagiBooking} from '../../packages/embed/index.mjs';
document.querySelector('#configure').addEventListener('submit',event=>{
 event.preventDefault();const slug=document.querySelector('#slug').value.trim();
 if(!/^[A-Za-z0-9_-]+$/.test(slug))return;
 mountMagiBooking(document.querySelector('#booking'),{bookingUrl:`https://www.magibooking.com/book/${slug}/`});
 document.querySelector('#status').textContent='The button opens the merchant’s booking page in a new tab.';
});
