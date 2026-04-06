export function PageSpinner() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

export function AdminCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0d3d5e]">{title}</h2>
            {children}
        </div>
    );
}

export function FormInput({
    label, value, onChange, placeholder, type = 'text',
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
            />
        </div>
    );
}

export function FormSelect({
    label, value, onChange, options, placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
}) {
    return (
        <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
            >
                <option value="" disabled>{placeholder ?? 'Select...'}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

export function FormFooter({
    msg, loading, onSubmit, label,
}: {
    msg: { ok: boolean; text: string } | null;
    loading: boolean;
    onSubmit: () => void;
    label: string;
}) {
    return (
        <div className="flex items-center justify-between pt-2">
            {msg ? (
                <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
            ) : <span />}
            <button
                onClick={onSubmit}
                disabled={loading}
                className="px-6 py-2.5 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors disabled:opacity-60"
            >
                {loading ? 'Saving...' : label}
            </button>
        </div>
    );
}