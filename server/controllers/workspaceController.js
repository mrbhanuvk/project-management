import prisma from '../config/prisma.js';

// Get all workspaces for user
export const getUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId: userId } },
      },
      include: {
        members: { include: { user: true } },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: {           // fixed: was "comments: comments:{...}"
                  include: { user: true },
                },
              },
            },
            members: { include: { user: true } },
          },
        },
        owner: true,
      },
    });
    res.json({ workspaces });
  } catch (error) {
    console.log(error);                // fixed: was "eror"
    res.status(500).json({ message: error.code || error.message }); // fixed: was "messeage"
  }
};

// Add member to workspace
export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { email, role, workspaceId, message } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!workspaceId || !role) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Fetch workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check requester has admin role
    // fixed: was "find(()=>member.userId=userId)" - missing param, using = instead of ===
    if (!workspace.members.find((member) => member.userId === userId && member.role === 'ADMIN')) {
      return res.status(401).json({ message: 'You do not have admin privileges' });
    }

    // Check if user is already a member
    // fixed: was checking userId instead of user.id (the target user, not the requester)
    const existingMember = workspace.members.find((member) => member.userId === user.id);

    if (existingMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    const newMember = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role,
        message,
      },
    });

    return res.json({ member: newMember, message: 'Member added successfully' });

  } catch (error) {
    console.log(error);                // fixed: was "eror"
    res.status(500).json({ message: error.code || error.message }); // fixed: was "messeage"
  }
};