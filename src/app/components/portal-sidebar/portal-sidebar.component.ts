import { Component, input, output } from '@angular/core';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  tab?: string;
  sub?: string;
  children?: SidebarItem[];
}

@Component({
  selector: 'app-portal-sidebar',
  standalone: true,
  templateUrl: './portal-sidebar.component.html',
  styleUrl: './portal-sidebar.component.css'
})
export class PortalSidebarComponent {
  items = input.required<SidebarItem[]>();
  activeTab = input('');
  activeSub = input('');
  expandedIds = input<string[]>([]);
  theme = input<'admin' | 'medico' | 'paciente'>('admin');

  navigate = output<SidebarItem>();
  toggleGroup = output<string>();

  isExpanded(id: string): boolean {
    return this.expandedIds().includes(id);
  }

  isActive(item: SidebarItem): boolean {
    if (!item.tab) return false;
    if (item.sub) {
      return this.activeTab() === item.tab && this.activeSub() === item.sub;
    }
    const sub = this.activeSub();
    return this.activeTab() === item.tab && (!sub || sub === '');
  }

  hasActiveChild(group: SidebarItem): boolean {
    return (group.children ?? []).some(c => this.isActive(c));
  }

  onClick(item: SidebarItem, isGroup: boolean): void {
    if (isGroup && item.children?.length) {
      this.toggleGroup.emit(item.id);
      return;
    }
    if (item.tab) this.navigate.emit(item);
  }
}
