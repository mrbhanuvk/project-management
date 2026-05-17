import { inngest } from './client.js';
import prisma from '../config/prisma.js';

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
    await prisma.user.deleteMany({
      where: { id: data.id },
    });
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
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: 'ADMIN',
      },
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
      },
    });
  }
);

const syncWorkspaceDeletion = inngest.createFunction(
  { id: 'delete-workspace-from-clerk', triggers: [{ event: 'clerk/organization.deleted' }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.deleteMany({
      where: { id: data.id },
    });
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

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
];

export { inngest };
