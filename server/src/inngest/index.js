import { Inngest } from 'inngest';
import prisma from '../config/prisma.js';
import sendEmail from '../config/nodemailer.js';

export const inngest = new Inngest({
  id: 'project-management-app',
});

const syncUserCreation = inngest.createFunction(
  { id: 'sync-user-from-clerk', triggers: [{ event: 'clerk/user.created' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.upsert({
      where: { id: data.id },
      update: {
        email: data.email_addresses[0]?.email_address,
        name: `${data.first_name || ''} ${data.last_name || ''}`,
        image: data.image_url,
      },
      create: {
        id: data.id,
        email: data.email_addresses[0]?.email_address,
        name: `${data.first_name || ''} ${data.last_name || ''}`,
        image: data.image_url,
      },
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: 'delete-user-from-clerk', triggers: [{ event: 'clerk/user.deleted' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.deleteMany({ where: { id: data.id } });
  }
);

const syncUserUpdation = inngest.createFunction(
  { id: 'update-user-from-clerk', triggers: [{ event: 'clerk/user.updated' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.update({
      where: { id: data.id },
      data: {
        email: data.email_addresses[0]?.email_address,
        name: `${data.first_name || ''} ${data.last_name || ''}`,
        image: data.image_url,
      },
    });
  }
);

const syncWorkspaceCreation = inngest.createFunction(
  { id: 'sync-workspace-from-clerk', triggers: [{ event: 'clerk/organization.created' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url || '',
        settings: {},
      }
    });
    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: 'ADMIN',
      }
    });
  }
);

const syncWorkspaceUpdation = inngest.createFunction(
  { id: 'update-workspace-from-clerk', triggers: [{ event: 'clerk/organization.updated' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url || '',
      }
    });
  }
);

const syncWorkspaceDeletion = inngest.createFunction(
  { id: 'delete-workspace-from-clerk', triggers: [{ event: 'clerk/organization.deleted' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.deleteMany({ where: { id: data.id } });
  }
);

const syncWorkspaceMemberCreation = inngest.createFunction(
  { id: 'sync-workspace-member-from-clerk', triggers: [{ event: 'clerk/organizationMembership.created' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: data.public_user_data.user_id,
          workspaceId: data.organization.id,
        },
      },
      update: {
        role: String(data.role).toUpperCase() === 'ORG:ADMIN' ? 'ADMIN' : 'MEMBER',
      },
      create: {
        userId: data.public_user_data.user_id,
        workspaceId: data.organization.id,
        role: String(data.role).toUpperCase() === 'ORG:ADMIN' ? 'ADMIN' : 'MEMBER',
      },
    });
  }
);

const sendTaskAssignmentEmail = inngest.createFunction(
  { id: 'send-task-assignment-mail', triggers: [{ event: 'app/task.assigned' }] },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, project: true }
    });

    if (!task) return;

    await sendEmail({
      to: task.assignee.email,
      subject: `New Task Assignment in ${task.project.name}`,
      body: `
        <div style="max-width: 600px;">
          <h2>Hi ${task.assignee.name}, 👋</h2>
          <p>You have been assigned a new task:</p>
          <p style="font-size: 18px; font-weight: bold; color: #007bff;">${task.title}</p>
          <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
            <p><strong>Description:</strong> ${task.description}</p>
            <p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
          </div>
          <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; text-decoration: none;">View Task</a>
          <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">Please complete it before the due date.</p>
        </div>
      `
    });

    if (new Date(task.due_date).toDateString() !== new Date().toDateString()) {
      await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

      await step.run('check-if-task-is-completed', async () => {
        const updatedTask = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true, project: true }
        });

        if (!updatedTask) return;

        if (updatedTask.status !== 'DONE') {
          await sendEmail({
            to: updatedTask.assignee.email,
            subject: `Reminder for ${updatedTask.project.name}`,
            body: `
              <div style="max-width: 600px;">
                <h2>Hi ${updatedTask.assignee.name}, ��</h2>
                <p>You have a task due in ${updatedTask.project.name}:</p>
                <p style="font-size: 18px; font-weight: bold; color: #007bff;">${updatedTask.title}</p>
                <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
                  <p><strong>Description:</strong> ${updatedTask.description}</p>
                  <p><strong>Due Date:</strong> ${new Date(updatedTask.due_date).toLocaleDateString()}</p>
                </div>
                <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; text-decoration: none;">View Task</a>
                <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">Please complete it before the due date.</p>
              </div>
            `
          });
        }
      });
    }
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
  sendTaskAssignmentEmail,
];

export { inngest };
