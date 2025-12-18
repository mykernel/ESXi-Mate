import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MENU_ITEMS } from '@/config/sidebarConfig';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 侧边栏 */}
      <aside
        className={cn(
          'bg-card border-r border-border transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo 区域 */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <h1 className="text-xl font-bold text-primary">ESXi-Mate</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-accent rounded-lg lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {MENU_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-primary text-primary-foreground'
                  )
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* 底部信息 */}
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              ESXi-Mate v0.1.0
            </p>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="h-16 border-b border-border bg-card">
          <div className="h-full px-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-accent rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm text-muted-foreground">
              ESXi-Mate
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};
export default Layout;
