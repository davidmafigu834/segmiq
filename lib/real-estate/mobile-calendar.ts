export type MobileCalendarEvent={id:string;type:string;startAt:string|null;endAt:null;allDay:boolean;date:string|null;timezone:string;relatedEntity:{type:string;id:string};title:string;permittedActions:string[]};
export function calendarWindow(from:string|null,to:string|null) {
 if(!from||!to||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>93*86400000) return null;
 return {from:new Date(from).toISOString(),to:new Date(to).toISOString()};
}
export function uniqueCalendarEvents(events:MobileCalendarEvent[]) {
 return [...new Map(events.map(e=>[e.id,e])).values()].sort((a,b)=>(a.startAt??a.date??"").localeCompare(b.startAt??b.date??""));
}
