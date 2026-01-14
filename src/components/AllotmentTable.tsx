import { useState } from 'react';
// import { Save } from 'lucide-react'; // Removed unused
import { IAllotment } from '@/models/Allotment';

const ERROR_OPTIONS = [
    'Wrong Solution',
    'Incorrect Answer Key',
    'No Correct Option',
    'Incorrect Question',
    'Incomplete Question',
    'Other Issues'
];

export default function AllotmentTable({ initialData, onDataChange }: { initialData: IAllotment[], onDataChange: () => void }) {
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    const handleUpdate = async (row: IAllotment, updates: Partial<IAllotment>) => {

        setLoadingIds(prev => new Set(prev).add(row._id as string));
        try {
            const res = await fetch('/api/update-allotment', {
                method: 'POST',

                body: JSON.stringify({ id: row._id, ...updates })
            });

            if (!res.ok) throw new Error('Update failed');

            // Ideally update local state optimistically, but for now we reload or just show success
            onDataChange();
        } catch {
            alert('Failed to save');
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);

                next.delete(row._id as string);
                return next;
            });
        }
    };

    // Internal state for inputs before submitting?
    // For "Video Link" user might want to type and then click submit.
    // Let's create a sub-component for the row or manage temporary state.
    // For simplicity, we can use uncontrolled inputs or local state per row.

    return (
        <div className="w-full overflow-x-auto pb-4">
            <table className="w-full text-xs border-collapse table-fixed">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold sticky top-0 z-10 shadow-md">
                    <tr>
                        <th className="p-2 border-y border-blue-500 w-12 text-center text-[10px]">#</th>
                        <th className="p-2 border-y border-blue-500 w-16">Cohort</th>
                        <th className="p-2 border-y border-blue-500 w-12">Class</th>
                        <th className="p-2 border-y border-blue-500 w-16">Subject</th>
                        <th className="p-2 border-y border-blue-500 w-14 text-center">Mod</th>
                        <th className="p-2 border-y border-blue-500 w-12 text-center">Ch</th>
                        <th className="p-2 border-y border-blue-500 w-32">Chapter</th>
                        <th className="p-2 border-y border-blue-500 w-28">Exercise</th>
                        <th className="p-2 border-y border-blue-500 w-12 text-center">Q#</th>
                        <th className="p-2 border-y border-blue-500 w-16 text-center">QBG</th>
                        <th className="p-2 border-y border-blue-500 w-14 text-center">Sol</th>
                        <th className="p-2 border-y border-blue-500 w-14 text-center">PPT</th>
                        <th className="p-2 border-y border-blue-500 w-16 text-center">Folder</th>

                        {/* Editable Area */}
                        <th className="p-2 border-y border-blue-400 bg-blue-800/30 w-48">📹 Video</th>
                        <th className="p-2 border-y border-blue-400 bg-blue-800/30 w-36">⚠️ Error</th>
                        <th className="p-2 border-y border-blue-500 w-20 text-[10px]">Added</th>
                        <th className="p-2 border-y border-blue-500 w-20 text-[10px]">Allotted</th>
                        <th className="p-2 border-y border-blue-500 w-20">Status</th>
                        <th className="p-2 border-y border-blue-500 w-16 text-center">Save</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {initialData.map((row, index) => (

                        <Row key={row._id} row={row} index={index} onSave={handleUpdate} saving={loadingIds.has(row._id as string)} />
                    ))}
                    {initialData.length === 0 && (
                        <tr>
                            <td colSpan={18} className="p-10 text-center text-gray-400">
                                No tasks allotted to you found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function Row({ row, index, onSave, saving }: { row: IAllotment, index: number, onSave: (r: IAllotment, u: Partial<IAllotment>) => void, saving: boolean }) {
    const [videoLink, setVideoLink] = useState(row.videoLink || '');
    const [error, setError] = useState(row.questionErrorIdentified || '');

    // Check if dirty
    const isDirty = videoLink !== (row.videoLink || '') || error !== (row.questionErrorIdentified || '');

    const handleSave = () => {
        onSave(row, {
            videoLink,
            questionErrorIdentified: error,
            status: (videoLink && videoLink.length > 5) ? 'Submitted' : 'Pending'
        });
    };

    return (
        <tr className={`hover:bg-blue-50 group transition-colors text-gray-900 border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
            <td className="p-1.5 text-center text-gray-500 font-mono text-[10px]">{row.sheetRowId}</td>
            <td className="p-1.5 font-medium truncate" title={row.cohort}>{row.cohort}</td>
            <td className="p-1.5 truncate" title={row.class}>{row.class}</td>
            <td className="p-1.5 truncate" title={row.subject}>{row.subject}</td>
            <td className="p-1.5 text-center">{row.moduleNo}</td>
            <td className="p-1.5 text-center">{row.chapterNumber}</td>
            <td className="p-1.5 truncate" title={row.chapterName}>{row.chapterName}</td>
            <td className="p-1.5 truncate" title={row.exerciseName}>{row.exerciseName}</td>
            <td className="p-1.5 text-center font-semibold">{row.qNo}</td>
            <td className="p-1.5 text-center">
                {row.qbgIdLinks && <a href={row.qbgIdLinks} target="_blank" className="text-blue-600 hover:underline text-[10px]">View</a>}
            </td>
            <td className="p-1.5 text-center text-[10px]">{row.textSolutionAvailable}</td>
            <td className="p-1.5 text-center">
                {row.pptLink && <a href={row.pptLink} target="_blank" className="text-blue-600 hover:underline text-[10px]">PPT</a>}
            </td>
            <td className="p-1.5 text-center">
                {row.videoFolderLink && <a href={row.videoFolderLink} target="_blank" className="text-blue-600 hover:underline text-[10px]">Folder</a>}
            </td>

            {/* Editable Inputs */}
            <td className="p-1 bg-blue-50/30">
                <div className="flex items-center gap-1">
                    <input
                        type="text"
                        value={videoLink}
                        onChange={(e) => setVideoLink(e.target.value)}
                        placeholder="Paste Link"
                        className="w-full px-1.5 py-1 border border-gray-300 rounded text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-[11px]"
                    />
                    {videoLink && (
                        <a
                            href={videoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Open Video Link"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                        </a>
                    )}
                </div>
            </td>
            <td className="p-1 bg-blue-50/30">
                <select
                    value={error}
                    onChange={(e) => setError(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none text-[11px] bg-white"
                    aria-label="Select Question Error"
                >
                    <option value="">-- Select --</option>
                    {ERROR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </td>

            <td className="p-1.5 text-gray-600 text-[10px] truncate" title={row.vsLinkAdditionDate}>{row.vsLinkAdditionDate}</td>
            <td className="p-1.5 text-gray-600 text-[10px] truncate" title={row.vsAllotmentDate}>{row.vsAllotmentDate}</td>
            <td className="p-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${row.status === 'Submitted'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {row.status || 'Pending'}
                </span>
            </td>
            <td className="p-1 text-center">
                <button
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                    className={`inline-flex items-center px-2 py-1 border border-transparent text-[11px] font-medium rounded shadow-sm text-white focus:outline-none focus:ring-1 focus:ring-offset-1 ${isDirty
                        ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        : 'bg-gray-300 cursor-not-allowed'
                        } ${saving ? 'opacity-75 cursor-wait' : ''}`}
                >
                    {saving ? 'Saving...' : 'Submit'}
                </button>
            </td>
        </tr>
    );
}
