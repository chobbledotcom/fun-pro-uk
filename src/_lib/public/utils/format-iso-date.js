// Format an ISO date string (YYYY-MM-DD) as "D MMMM YYYY" (e.g. "7 May 2026")

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatIsoDate = (iso) => {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};
