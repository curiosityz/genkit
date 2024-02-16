import { getProjectId } from '@google-genkit/common';
import { configureGenkit } from '@google-genkit/common/config';
import { firebase } from '@google-genkit/providers/firebase';

export default configureGenkit({
  plugins: [firebase({ projectId: getProjectId() })],
  flowStateStore: 'firestoreStores',
  traceStore: 'firestoreStores',
  enableTracingAndMetrics: true,
  logLevel: 'info',
});
