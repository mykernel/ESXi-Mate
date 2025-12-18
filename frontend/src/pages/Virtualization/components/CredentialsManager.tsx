import { useState, useEffect } from 'react';
import { credentialsApi, Credential } from '@/api/credentials';
import { Plus, Trash2, Key, Loader2 } from 'lucide-react';

export const CredentialsManager = ({ 
    isOpen, 
    onClose, 
    onSelect 
}: { 
    isOpen: boolean; 
    onClose: () => void;
    onSelect?: (cred: Credential) => void;
}) => {
    const [creds, setCreds] = useState<Credential[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    
    // Create form
    const [newName, setNewName] = useState('');
    const [newUsername, setNewUsername] = useState('root');
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (isOpen) loadCreds();
    }, [isOpen]);

    const loadCreds = async () => {
        setIsLoading(true);
        try {
            const data = await credentialsApi.list();
            setCreds(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName || !newUsername || !newPassword) return;
        setIsCreating(true);
        try {
            await credentialsApi.create({
                name: newName,
                username: newUsername,
                password: newPassword
            });
            setNewName('');
            setNewPassword('');
            loadCreds();
        } catch (e) {
            alert("创建失败");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("确定删除?")) return;
        try {
            await credentialsApi.delete(id);
            loadCreds();
        } catch (e) {
            alert("删除失败");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-lg border border-border flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-semibold">凭证管理</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <span className="text-2xl">×</span>
                    </button>
                </div>
                
                <div className="p-6 flex-1 overflow-auto space-y-6">
                    {/* Create Form */}
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                        <h4 className="text-sm font-medium">添加新凭证</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="名称 (如: Default Root)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                            <input 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="用户名 (如: root)"
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="password"
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="密码"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                            <button 
                                onClick={handleCreate}
                                disabled={isCreating || !newName || !newPassword}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4 py-2"
                            >
                                {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                                添加
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">已保存凭证</h4>
                        {isLoading ? (
                            <div className="text-center py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                        ) : creds.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">暂无凭证</div>
                        ) : (
                            <div className="grid gap-2">
                                {creds.map(cred => (
                                    <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 text-primary rounded-full">
                                                <Key className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{cred.name}</div>
                                                <div className="text-xs text-muted-foreground">{cred.username}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {onSelect && (
                                                <button 
                                                    onClick={() => onSelect(cred)}
                                                    className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded border border-border transition-colors"
                                                >
                                                    选择
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleDelete(cred.id)}
                                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
