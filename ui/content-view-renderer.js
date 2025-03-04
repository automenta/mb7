ui/content-view-renderer.js
import { format, parseISO } from 'date-fns';

export const renderContent = (yText) => {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content-display';
    contentDiv.innerHTML = yText.toString().replace(/\n/g, '<br>');
    return contentDiv;
};


export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), 'yyyy-MM-dd')
        : '';


const isValidDate = (date) => date instanceof Date && !isNaN(date);
