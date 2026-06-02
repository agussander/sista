export function getNextWeekDays() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToNextMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);

    const days = [];
    for (let i = 0; i < 6; i++) { // Monday to Saturday
        const nextDay = new Date(nextMonday);
        nextDay.setDate(nextMonday.getDate() + i);

        // Formatting the date as dd-mm-yyyy
        const day = String(nextDay.getDate()).padStart(2, '0');
        const month = String(nextDay.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = nextDay.getFullYear();

        days.push(`${day}-${month}-${year}`);
    }
    
    return days;
}



