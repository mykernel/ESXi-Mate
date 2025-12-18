/**
 * 极简侧边栏配置，仅保留 ESXi 相关入口
 */

export const MENU_ITEMS = [
  {
    id: 'virt-dashboard',
    label: '概览',
    path: '/virtualization/dashboard',
  },
  {
    id: 'virt-instances',
    label: '虚拟机',
    path: '/virtualization/instances',
  },
  {
    id: 'virt-hosts',
    label: 'ESXi 主机',
    path: '/virtualization/hosts',
  },
];
