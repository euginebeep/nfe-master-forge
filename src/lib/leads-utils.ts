export const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const isDemoExpired = (createdAtStr: string, limitDays: number = 15): boolean => {
  const createdAt = new Date(createdAtStr);
  const now = new Date();
  const diffInMs = now.getTime() - createdAt.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  return diffInDays > limitDays;
};
