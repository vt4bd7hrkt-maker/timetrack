/**
 * Minimal i18n (runes module). English default, German available in Settings.
 * t() reads settings.language, so any template using it re-renders on change.
 */
import { settings } from './store.svelte.js';

const dict = {
  en: {
    home: 'Home', projects: 'Projects', stats: 'Stats', calendar: 'Calendar', settings: 'Settings',
    today: 'Today', thisWeek: 'This week', thisMonth: 'This month', thisYear: 'This year', customRange: 'Custom',
    activeTimers: 'Active timers', remaining: 'remaining', ofQuota: 'of', tracked: 'tracked',
    newProject: 'New project', editProject: 'Edit project', title: 'Title', client: 'Client',
    description: 'Description', quota: 'Hour quota', rate: 'Hourly rate', color: 'Color', status: 'Status',
    active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', archive: 'Archive', unarchive: 'Unarchive',
    addTimeManually: 'Add time manually', forgotTracking: 'Forgot to track?', startTracking: 'Start tracking',
    startDate: 'Start date', startTime: 'Start time', endDate: 'End date', endTime: 'End time',
    comment: 'Comment', optional: 'optional', addTime: 'Add time', startedAt: 'Timer starts retroactively at',
    totalHours: 'Total hours', hoursPerProject: 'Hours per project', distribution: 'Distribution',
    avgPerDay: 'Avg / day', avgPerWeek: 'Avg / week', avgPerMonth: 'Avg / month',
    perDay: 'Hours per day', noData: 'No data for this range',
    search: 'Search projects, clients…', noProjects: 'No projects yet. Create your first one.',
    noEntries: 'No time entries yet', history: 'History', quotaLabel: 'Quota', restLabel: 'Remaining',
    entries: 'Entries', worked: 'worked', lastStarted: 'Last started', restAll: 'Open hours',
    theme: 'Appearance', light: 'Light', dark: 'Dark', system: 'System',
    language: 'Language', dailyGoal: 'Daily hour goal', backup: 'Backup',
    exportJson: 'Export data (JSON)', importJson: 'Import data (JSON)', export: 'Export',
    exportCsv: 'CSV', exportXlsx: 'Excel', exportPdf: 'PDF report', allProjects: 'All projects',
    range: 'Range', project: 'Project', dangerZone: 'Danger zone', eraseAll: 'Erase all data',
    eraseConfirm: 'Delete ALL projects and entries? This cannot be undone.',
    importConfirm: 'Import will merge backup data into the current data. Continue?',
    archiveConfirm: 'Archive this project?', deleteEntryConfirm: 'Delete this entry?',
    start: 'Start', end: 'End', duration: 'Duration', date: 'Date',
    editEntry: 'Edit entry', running: 'Running', addProjectFirst: 'Create a project to start tracking',
    invalidRange: 'End must be after start', hours: 'h', from: 'From', to: 'To',
    reminderTitle: 'Timer still running', reminderBody: 'has been running for over',
    longRunReminder: 'Reminder for long-running timers', goalReached: 'Daily goal',
    statsFor: 'Stats', showArchived: 'Show archived', name: 'Name', total: 'Total',
    cloudBackup: 'Automatic cloud backup',
    cloudInfo: 'Backs up all data to your private GitHub repository a few seconds after every change. Paste your backup key to enable it.',
    cloudToken: 'Backup key', connect: 'Connect', disconnect: 'Disconnect',
    backupNow: 'Back up now', restoreCloud: 'Restore from cloud',
    lastBackup: 'Last backup', neverBackedUp: 'no backup yet',
    backupSaving: 'Backing up…', backupOffline: 'Offline — will back up when online',
    backupError: 'Backup failed', invalidToken: 'Key not valid — check it and try again',
    restoreConfirm: 'Restore the cloud backup into this app? Existing data is merged, nothing is lost.',
    restoreDone: 'Backup restored', restoreFromBackup: 'Restore from cloud backup'
  },
  de: {
    home: 'Home', projects: 'Projekte', stats: 'Statistik', calendar: 'Kalender', settings: 'Einstellungen',
    today: 'Heute', thisWeek: 'Diese Woche', thisMonth: 'Dieser Monat', thisYear: 'Dieses Jahr', customRange: 'Eigener',
    activeTimers: 'Aktive Timer', remaining: 'übrig', ofQuota: 'von', tracked: 'erfasst',
    newProject: 'Neues Projekt', editProject: 'Projekt bearbeiten', title: 'Titel', client: 'Kunde',
    description: 'Beschreibung', quota: 'Stundenkontingent', rate: 'Stundenlohn', color: 'Farbe', status: 'Status',
    active: 'Aktiv', paused: 'Pausiert', completed: 'Abgeschlossen', archived: 'Archiviert',
    save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', edit: 'Bearbeiten', archive: 'Archivieren', unarchive: 'Wiederherstellen',
    addTimeManually: 'Zeit manuell hinzufügen', forgotTracking: 'Tracking vergessen?', startTracking: 'Tracking starten',
    startDate: 'Startdatum', startTime: 'Startzeit', endDate: 'Enddatum', endTime: 'Endzeit',
    comment: 'Kommentar', optional: 'optional', addTime: 'Zeit hinzufügen', startedAt: 'Timer startet rückwirkend um',
    totalHours: 'Stunden gesamt', hoursPerProject: 'Stunden pro Projekt', distribution: 'Verteilung',
    avgPerDay: 'Ø / Tag', avgPerWeek: 'Ø / Woche', avgPerMonth: 'Ø / Monat',
    perDay: 'Stunden pro Tag', noData: 'Keine Daten in diesem Zeitraum',
    search: 'Projekte, Kunden suchen…', noProjects: 'Noch keine Projekte. Lege dein erstes an.',
    noEntries: 'Noch keine Zeiteinträge', history: 'Historie', quotaLabel: 'Kontingent', restLabel: 'Verbleibend',
    entries: 'Einträge', worked: 'gearbeitet', lastStarted: 'Zuletzt gestartet', restAll: 'Offene Stunden',
    theme: 'Darstellung', light: 'Hell', dark: 'Dunkel', system: 'System',
    language: 'Sprache', dailyGoal: 'Stundenziel pro Tag', backup: 'Backup',
    exportJson: 'Daten exportieren (JSON)', importJson: 'Daten importieren (JSON)', export: 'Export',
    exportCsv: 'CSV', exportXlsx: 'Excel', exportPdf: 'PDF-Report', allProjects: 'Alle Projekte',
    range: 'Zeitraum', project: 'Projekt', dangerZone: 'Gefahrenzone', eraseAll: 'Alle Daten löschen',
    eraseConfirm: 'ALLE Projekte und Einträge löschen? Das kann nicht rückgängig gemacht werden.',
    importConfirm: 'Der Import führt Backup-Daten mit den aktuellen Daten zusammen. Fortfahren?',
    archiveConfirm: 'Projekt archivieren?', deleteEntryConfirm: 'Eintrag löschen?',
    start: 'Start', end: 'Ende', duration: 'Dauer', date: 'Datum',
    editEntry: 'Eintrag bearbeiten', running: 'Läuft', addProjectFirst: 'Lege ein Projekt an, um zu starten',
    invalidRange: 'Ende muss nach dem Start liegen', hours: 'h', from: 'Von', to: 'Bis',
    reminderTitle: 'Timer läuft noch', reminderBody: 'läuft seit über', longRunReminder: 'Erinnerung bei langen Timern',
    goalReached: 'Tagesziel', statsFor: 'Statistik', showArchived: 'Archivierte anzeigen', name: 'Name', total: 'Gesamt',
    cloudBackup: 'Automatisches Cloud-Backup',
    cloudInfo: 'Sichert alle Daten wenige Sekunden nach jeder Änderung in dein privates GitHub-Repository. Füge deinen Backup-Schlüssel ein, um es zu aktivieren.',
    cloudToken: 'Backup-Schlüssel', connect: 'Verbinden', disconnect: 'Trennen',
    backupNow: 'Jetzt sichern', restoreCloud: 'Aus Cloud wiederherstellen',
    lastBackup: 'Letztes Backup', neverBackedUp: 'noch kein Backup',
    backupSaving: 'Sichert…', backupOffline: 'Offline — wird nachgeholt',
    backupError: 'Backup fehlgeschlagen', invalidToken: 'Schlüssel ungültig — bitte prüfen und erneut versuchen',
    restoreConfirm: 'Cloud-Backup in diese App zurückspielen? Vorhandene Daten werden zusammengeführt, nichts geht verloren.',
    restoreDone: 'Backup wiederhergestellt', restoreFromBackup: 'Aus Cloud-Backup wiederherstellen'
  }
};

export function t(key) {
  const lang = dict[settings.language] ? settings.language : 'en';
  return dict[lang][key] ?? dict.en[key] ?? key;
}
