import { OFFICE_HOURS } from "../config/office-hours.config";

/**
 * Checks if the given date is outside of standard office hours.
 * Standard office hours are from startHour (inclusive) to endHour (exclusive).
 * For example, 9:00 AM to 5:00 PM: [9, 17)
 */
export const isAfterHours = (date: Date = new Date()): boolean => {
  const hour = date.getHours();
  return hour < OFFICE_HOURS.startHour || hour >= OFFICE_HOURS.endHour;
};
