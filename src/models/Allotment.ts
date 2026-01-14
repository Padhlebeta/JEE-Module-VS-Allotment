import { Schema, model, models } from 'mongoose';

export interface IAllotment {
    _id?: string;
    sheetRowId: number; // To map back to Google Sheet
    cohort: string;
    class: string;
    subject: string;
    moduleNo: string; // Used string as it might be "1" or "M1"
    chapterNumber: string;
    chapterName: string;
    exerciseName: string;
    qNo: string;
    qbgIdLinks: string;
    textSolutionAvailable: string;
    pptLink: string;
    videoFolderLink: string;

    // Fields Editable by Teacher
    videoLink: string;
    questionErrorIdentified: string;
    status: string; // Pending / Completed

    // Dates
    vsLinkAdditionDate: string;
    vsAllotmentDate: string;

    // Auth & System
    teacherEmail: string; // The email this row is assigned to
    lastSyncedAt: Date;

    // Metadata for Write-Back
    sheetTitle?: string;
    videoLinkCol?: number;
    errorCol?: number;
    linkDateCol?: number;
}

const AllotmentSchema = new Schema<IAllotment>({
    sheetRowId: { type: Number, required: true, unique: true },

    cohort: { type: String, default: '' },
    class: { type: String, default: '' },
    subject: { type: String, default: '' },
    moduleNo: { type: String, default: '' },
    chapterNumber: { type: String, default: '' },
    chapterName: { type: String, default: '' },
    exerciseName: { type: String, default: '' },
    qNo: { type: String, default: '' },
    qbgIdLinks: { type: String, default: '' },
    textSolutionAvailable: { type: String, default: '' },
    pptLink: { type: String, default: '' },
    videoFolderLink: { type: String, default: '' },

    // Editable
    videoLink: { type: String, default: '' },
    questionErrorIdentified: { type: String, default: '' },
    status: { type: String, default: 'Pending' },

    // Dates
    vsLinkAdditionDate: { type: String, default: '' },
    vsAllotmentDate: { type: String, default: '' },

    // Crucial for logic
    teacherEmail: { type: String, required: true, index: true },

    // New: Metadata for Write-back
    sheetTitle: { type: String },
    videoLinkCol: { type: Number }, // Index of 'Video Link' column
    errorCol: { type: Number },     // Index of 'Error' column
    linkDateCol: { type: Number },  // Index of 'Link Addition Date' column

    lastSyncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Prevent overwrite on HMR but FORCE update if schema changed (Dev only hack or standard pattern?)
// For now, let's delete it if we are in dev/debugging to ensure new fields are picked up
if (process.env.NODE_ENV === 'development') {
    if (models.Allotment) {
        delete models.Allotment;
    }
}

const Allotment = models.Allotment || model<IAllotment>('Allotment', AllotmentSchema);

export default Allotment;
