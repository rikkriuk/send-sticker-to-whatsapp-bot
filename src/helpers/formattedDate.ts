export const formattedDate = (date: Date | undefined) => {
   if (!date) return '-';

   return date.toLocaleDateString('id-ID', {
      weekday: 'long',  
      day: '2-digit',  
      month: 'long', 
      year: 'numeric',
   });

}