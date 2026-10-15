/**
 * Real-shaped M-Pesa confirmation messages received on the business line.
 * Add every new format you receive here and a matching expectation in mpesa.test.ts.
 */
export const fixtures = {
  till: "TJ4AB12XYZ Confirmed. You have received Ksh2,000.00 from JOHN DOE 0712345678 on 14/10/26 at 3:41 PM. New M-PESA balance is Ksh45,210.00. Separate personal and business funds through Pochi la Biashara on *334#.",
  tillMasked: "TJE7QX1PLM Confirmed. You have received Ksh3,500.00 from WANJIRU KAMAU 0712***678 on 15/10/26 at 10:05 AM New M-PESA balance is Ksh12,000.00.",
  paybill: "TJF2KD8RTY Confirmed. on 16/10/26 at 9:12 AM Ksh15,000.00 received from BRIAN OTIENO 254722111222. Account Number DRINK New Utility balance is Ksh80,000.00",
  noDecimals: "TJG9HH3WQA Confirmed. You have received Ksh 6,400 from MARY A. NJERI 0110123456 on 1/11/26 at 12:00 PM.",
  lowercase: "tjh1aa2bb3 confirmed. you have received ksh500.00 from peter mwangi 0798765432 on 02/11/2026 at 11:59 pm.",
  garbage: "Hi, I've sent the deposit, check please",
  sentNotReceived: "TJ4AB12XYZ Confirmed. Ksh2,000.00 sent to JOHN DOE 0712345678 on 14/10/26 at 3:41 PM.",
};
