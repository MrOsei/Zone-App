import { getDb } from "./db";

export function listPosts(userId: string, communityId?: string, postId?: string) {
  const where = postId ? "p.id=@postId" : communityId ? "p.community_id=@communityId" : "1=1";
  const rows = getDb().prepare(`SELECT p.*,u.name author_name,u.username author_username,u.avatar_url author_avatar,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comment_count,
    EXISTS(SELECT 1 FROM likes mine WHERE mine.post_id=p.id AND mine.user_id=@userId) liked,
    sp.body shared_body,sp.created_at shared_created_at,su.name shared_author_name,su.username shared_author_username,su.avatar_url shared_author_avatar,
    c.name community_name
    FROM posts p JOIN users u ON u.id=p.author_id
    LEFT JOIN posts sp ON sp.id=p.shared_post_id LEFT JOIN users su ON su.id=sp.author_id
    LEFT JOIN communities c ON c.id=p.community_id
    WHERE ${where}
    AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=@userId AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=@userId))
    ORDER BY p.created_at DESC LIMIT 100`).all({ userId, communityId, postId }) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id, body: row.body, createdAt: row.created_at, likeCount: Number(row.like_count), commentCount: Number(row.comment_count),
    liked: Boolean(row.liked), communityId: row.community_id, communityName: row.community_name,
    author: { id: row.author_id, name: row.author_name, username: row.author_username, avatarUrl: row.author_avatar },
    sharedPost: row.shared_post_id ? { id: row.shared_post_id, body: row.shared_body, createdAt: row.shared_created_at,
      author: { name: row.shared_author_name, username: row.shared_author_username, avatarUrl: row.shared_author_avatar } } : null,
  }));
}
