export const isValidWhatsAppNumber = (number: string): string | null => {
   const regex = /^(\+62|62|08)[1-9][0-9]{7,11}$/;
   
   if (regex.test(number)) {
      const formattedNumber = number
         .replace(/\D/g, "")
         .replace(/^0/, "62");

      return formattedNumber;
   }

   return null;
};
