import { getProfiles, getTasks } from "@/lib/data";
import { WorkloadView } from "@/components/workload/workload-view";

export default async function WorkloadPage() {
  const [tasks, profiles] = await Promise.all([getTasks(), getProfiles()]);
  return <WorkloadView tasks={tasks} profiles={profiles} />;
}
