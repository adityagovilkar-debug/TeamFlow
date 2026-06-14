import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  getChecklist,
  getComments,
  getFolders,
  getParentSummary,
  getProfiles,
  getStatuses,
  getSubtasks,
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
  const [
    profile,
    task,
    comments,
    statuses,
    teams,
    profiles,
    subtasks,
    checklist,
    folders,
  ] = await Promise.all([
    getCurrentProfile(),
    getTaskById(id),
    getComments(id),
    getStatuses(),
    getTeams(),
    getProfiles(),
    getSubtasks(id),
    getChecklist(id),
    getFolders(),
  ]);

  if (!task) notFound();

  const parent = task.parent_id
    ? await getParentSummary(task.parent_id)
    : null;

  return (
    <TaskDetail
      me={profile!}
      task={task}
      parent={parent}
      subtasks={subtasks}
      comments={comments}
      checklist={checklist}
      statuses={statuses}
      teams={teams}
      profiles={profiles}
      folders={folders}
    />
  );
}
