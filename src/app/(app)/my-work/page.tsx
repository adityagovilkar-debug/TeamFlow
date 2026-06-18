import { getCurrentProfile } from "@/lib/auth";
import { getTasks } from "@/lib/data";
import { MyWorkView } from "@/components/my-work/my-work-view";

export default async function MyWorkPage() {
  const [profile, tasks] = await Promise.all([getCurrentProfile(), getTasks()]);
  return <MyWorkView meId={profile!.id} tasks={tasks} />;
}
