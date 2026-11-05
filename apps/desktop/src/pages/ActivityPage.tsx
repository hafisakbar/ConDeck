import { ActivityList } from '../components/activity/ActivityList';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { useAppStore } from '../stores/app-store';

export function ActivityPage() {
  const activity = useAppStore((state) => state.activity);

  return (
    <Panel>
      <PanelHeader
        title="Activity"
        description={`${activity.length} recorded event${activity.length === 1 ? '' : 's'}, newest first.`}
      />
      <ActivityList logs={activity} />
    </Panel>
  );
}
