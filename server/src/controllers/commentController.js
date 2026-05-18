import prisma from "../config/prisma.js";  // fixed: missing .js

export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, taskId } = req.body;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: { include: { user: true } } }
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const member = project.members.find((member) => member.userId === userId);  // fixed: was project.member
    if (!member) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    const comment = await prisma.comment.create({
      data: { taskId, content, userId },  // fixed: removed duplicate data block and wrong 'comment' field
      include: { user: true }             // fixed: moved include inside create call
    });

    res.json({ comment });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: true }
    });

    res.json({ comments });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};