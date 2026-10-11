"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { firebase } from "./firebase";
import type { UserProfile } from "./types";

export interface WorkoutComment {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorPhotoURL: string | null;
  text: string;
  createdAt: Timestamp;
}

export const MAX_COMMENT_LENGTH = 500;

const likesCol = (ownerUid: string, workoutId: string) =>
  collection(firebase().db, "users", ownerUid, "workouts", workoutId, "likes");
const commentsCol = (ownerUid: string, workoutId: string) =>
  collection(firebase().db, "users", ownerUid, "workouts", workoutId, "comments");

/** Public link to a workout. Works for anyone while the owner's account is public. */
export function workoutUrl(ownerUid: string, workoutId: string) {
  return `${location.origin}${workoutPath(ownerUid, workoutId)}`;
}

export function workoutPath(ownerUid: string, workoutId: string) {
  return `/w/${ownerUid}/${workoutId}`;
}

/**
 * Like state for one workout: count, whether the viewer liked it, and an optimistic toggle.
 * Counts use server-side aggregation, so no counters need to be kept in sync.
 */
export function useLikes(ownerUid: string, workoutId: string, viewerUid: string | null) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    getCountFromServer(likesCol(ownerUid, workoutId))
      .then((s) => setCount(s.data().count))
      .catch(() => setCount(null));
    if (viewerUid) {
      getDoc(doc(likesCol(ownerUid, workoutId), viewerUid))
        .then((s) => setLiked(s.exists()))
        .catch(() => {});
    }
  }, [ownerUid, workoutId, viewerUid]);

  const toggle = useCallback(async () => {
    if (!viewerUid) return;
    const next = !liked;
    setLiked(next);
    setCount((c) => (c == null ? c : c + (next ? 1 : -1)));
    const ref = doc(likesCol(ownerUid, workoutId), viewerUid);
    try {
      if (next) await setDoc(ref, { createdAt: serverTimestamp() });
      else await deleteDoc(ref);
    } catch (err) {
      // Roll back the optimistic update.
      setLiked(!next);
      setCount((c) => (c == null ? c : c + (next ? -1 : 1)));
      throw err;
    }
  }, [liked, ownerUid, workoutId, viewerUid]);

  return { count, liked, toggle };
}

/** Live comments on a workout, oldest first. null while loading. */
export function useComments(ownerUid: string, workoutId: string) {
  const [comments, setComments] = useState<WorkoutComment[] | null>(null);
  useEffect(() => {
    return onSnapshot(
      query(commentsCol(ownerUid, workoutId), orderBy("createdAt", "asc")),
      (snap) =>
        setComments(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as WorkoutComment,
          ),
        ),
      (err) => {
        console.error("Couldn't load comments", err);
        setComments([]);
      },
    );
  }, [ownerUid, workoutId]);
  return comments;
}

export function addComment(ownerUid: string, workoutId: string, author: UserProfile, text: string) {
  return addDoc(commentsCol(ownerUid, workoutId), {
    authorUid: author.uid,
    authorUsername: author.username,
    authorPhotoURL: author.photoURL,
    text: text.trim().slice(0, MAX_COMMENT_LENGTH),
    createdAt: serverTimestamp(),
  });
}

export function deleteComment(ownerUid: string, workoutId: string, commentId: string) {
  return deleteDoc(doc(commentsCol(ownerUid, workoutId), commentId));
}

/**
 * Opens the phone's share sheet when available, otherwise copies the link.
 * Returns "copied" so the caller can show feedback; "shared"/"cancelled" otherwise.
 */
export async function shareLink(title: string, url: string): Promise<"shared" | "copied" | "cancelled"> {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
      // Fall through to copying if the share sheet failed.
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
