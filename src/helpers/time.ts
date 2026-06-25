export function getTimeUntilReset(updatedAt: Date | undefined): string {
   if (!updatedAt) return "00j 00m 00d";
   
   const resetTime = new Date(updatedAt).getTime() + 24 * 60 * 60 * 1000;
   const diff = resetTime - Date.now();

   if (diff <= 0) return "00j 00m 00d";

   const hours = Math.floor(diff / (1000 * 60 * 60));
   const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
   const seconds = Math.floor((diff % (1000 * 60)) / 1000);

   return `${String(hours).padStart(2, "0")}j ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}d`;
}