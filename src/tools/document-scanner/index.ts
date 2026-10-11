import { Scan } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.document-scanner.title'),
  path: '/document-scanner',
  description: translate('tools.document-scanner.description'),
  keywords: ['scan', 'scanner', 'document', 'camera', 'pdf', 'pages', 'receipt', 'paper', 'photo'],
  component: () => import('./document-scanner.vue'),
  icon: Scan,
  createdAt: new Date('2025-01-01'),
});
