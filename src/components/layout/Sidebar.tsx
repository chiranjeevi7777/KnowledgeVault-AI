import { useEffect, useState, useCallback } from 'react';
import { Plus, Clock, ChevronDown, LogOut, Search, Box as BoxIcon, FolderOpen, Loader2 } from 'lucide-react';

interface SidebarProps {
  mode:       'user' | 'developer';
  onLogout:   () => void;
  onNewChat?: () => void;
  onSelectQuery?: (query: string) => void;
}

interface FolderNode {
  id:       string;
  name:     string;
  children: FolderNode[];
}

interface HistoryItem {
  id:    string;
  query: string;
  title: string;
  time:  string;
}

export default function Sidebar({ mode, onLogout, onNewChat, onSelectQuery }: SidebarProps) {
  const [folders,          setFolders]          = useState<FolderNode[]>([]);
  const [foldersExpanded,  setFoldersExpanded]  = useState(true);
  const [historyExpanded,  setHistoryExpanded]  = useState(true);
  const [retrievalHistory, setRetrievalHistory] = useState<HistoryItem[]>([]);
  const [foldersLoading,   setFoldersLoading]   = useState(false);

  const fetchHistory = useCallback(() => {
    fetch('/api/history/queries')
      .then((r) => r.json())
      .then((data) => {
        if (data.history) {
          setRetrievalHistory(data.history.slice(0, 8));
        }
      })
      .catch((err) => console.error('Failed to load retrieval history:', err));
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 20_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  useEffect(() => {
    setFoldersLoading(true);
    fetch('/api/folders')
      .then((r) => r.json())
      .then((data) => {
        if (data.folders?.length) setFolders(data.folders);
      })
      .catch(() => { /* Backend may not be running */ })
      .finally(() => setFoldersLoading(false));
  }, []);

  const handleHistoryClick = (item: HistoryItem) => {
    if (onSelectQuery) onSelectQuery(item.query);
    if (onNewChat) onNewChat(); // start fresh chat context
  };

  return (
    <div className="w-72 bg-[#FBFCFE] border-r border-slate-100 flex flex-col h-screen p-6 relative">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-10 pl-2">
        <div className="w-10 h-10 bg-box-blue rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-100">
          B
        </div>
        <div className="flex flex-col">
          <span className="text-slate-800 font-bold text-lg leading-none tracking-tight">Box Agent</span>
          <span className="text-slate-400 text-[10px] font-bold tracking-widest leading-none mt-1 uppercase">
            RAG Retrieval
          </span>
        </div>
      </div>

      {/* Primary Action */}
      <button
        id="new-retrieval-btn"
        onClick={onNewChat}
        className="flex items-center justify-between w-full bg-slate-900 text-white rounded-xl py-4 px-4 mb-8 shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98] group"
      >
        <div className="flex items-center gap-3">
          <Plus className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
          <span className="font-bold text-sm tracking-tight text-white/90">New Retrieval</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-2 py-0.5 rounded border border-white/5">
          <span className="text-[10px] font-bold text-white/40">⌘</span>
          <span className="text-[10px] font-bold text-white/40">K</span>
        </div>
      </button>

      <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar scroll-smooth">

        {/* ── Retrieval History ── */}
        <section className="space-y-3">
          <h3
            className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase pl-3 flex items-center justify-between cursor-pointer"
            onClick={() => setHistoryExpanded(!historyExpanded)}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" /> Retrieval History
            </div>
            <ChevronDown className={`w-3 h-3 transition-transform ${historyExpanded ? '' : '-rotate-90'}`} />
          </h3>

          {historyExpanded && (
            <div className="space-y-1">
              {retrievalHistory.length === 0 ? (
                <p className="text-xs text-slate-300 px-3 py-2 font-medium">No queries yet.</p>
              ) : (
                retrievalHistory.map((item) => (
                  <button
                    key={item.id}
                    id={`history-item-${item.id}`}
                    onClick={() => handleHistoryClick(item)}
                    title={`Re-ask: "${item.query}"`}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white hover:shadow-sm transition-all text-slate-500 hover:text-slate-800 text-left group"
                  >
                    <Search className="w-4 h-4 text-slate-300 group-hover:text-box-blue shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-semibold truncate block">{item.title || item.query}</span>
                      <span className="text-[10px] text-slate-300">{item.time}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        {/* ── Box Folders (live from API) ── */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase pl-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BoxIcon className="w-3 h-3" /> Box Folders
            </div>
            <button onClick={() => setFoldersExpanded(!foldersExpanded)}>
              <ChevronDown className={`w-3 h-3 transition-transform ${foldersExpanded ? '' : '-rotate-90'}`} />
            </button>
          </h3>

          {foldersExpanded && (
            <div className="space-y-1">
              {foldersLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-slate-300">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">Loading folders…</span>
                </div>
              ) : folders.length > 0 ? (
                folders.flatMap((folder) => [
                  <button
                    key={folder.id}
                    id={`folder-${folder.id}`}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-bold bg-blue-50/50 text-box-blue border border-blue-100/50"
                  >
                    <FolderOpen className="w-4 h-4 text-box-blue shrink-0" />
                    <span className="text-sm truncate">{folder.name}</span>
                  </button>,
                  ...(folder.children || []).map((child) => (
                    <button
                      key={child.id}
                      id={`folder-${child.id}`}
                      className="flex items-center gap-3 w-full pl-8 pr-4 py-2 rounded-xl transition-all text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    >
                      <BoxIcon className="w-3 h-3 opacity-40 shrink-0" />
                      <span className="text-xs font-semibold truncate">{child.name}</span>
                    </button>
                  )),
                ])
              ) : (
                <p className="text-xs text-slate-300 px-3 py-2 font-medium">
                  No folders found. Check BOX_ROOT_FOLDER_ID in your .env.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Footer / Logout */}
      <div className="pt-6 border-t border-slate-100">
        <button
          id="logout-btn"
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-4 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all font-bold text-sm group"
        >
          <LogOut className="w-5 h-5 opacity-40 group-hover:opacity-100" />
          Logout
        </button>
      </div>
    </div>
  );
}
