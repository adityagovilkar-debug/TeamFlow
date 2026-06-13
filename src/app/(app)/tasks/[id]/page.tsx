import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  getComments,
  getProfiles,
  getStatuses,
  getTaskById,
  getTeams,
} from "@/lib/data";
import { TaskDetail } from "@/components/tasks/task-detail";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, task, comments, statuses, teams, profiles] =
    await Promise.all([
      getCurrentProfile(),
      getTaskById(id),
      getComments(id),
      getStatuses(),
      getTeams(),
      getProfiles(),
    ]);

  if (!task) notFound();

  return (
    <TaskDetail
      me={profile!}
      task={task}
      comments={comments}
      statuses={statuses}
      teams={teams}
      profiles={profiles}
    />
  );
}
