"use client";

import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebase } from "./firebase";
import { getProfile } from "./profile";
import type { UserProfile, Workout } from "./types";
import { toWorkouts, workoutsQuery } from "./workouts";

/*
 * Following, like Hevy. users/{uid}/following/{target} is mirrored by users/{target}/followers/{uid},
 * and both are written in one batch (firestore.rules checks they match). Public accounts can be
 * followed straight away; private ones get users/{target}/followRequests/{uid}, which the owner
 * accepts (writing both follow docs) or declines.
 */

const col = (uid: string, name: "following" | "followers" | "followRequests") =>
  collection(firebase().db, "users", uid, name);

/** A user's profile page. Your own redirects to /profile. */
export function profilePath(uid: string) {
  return `/u/${uid}`;
}

/** Follows a public account, or asks to follow a private one. */
export async function follow(viewerUid: string, target: UserProfile) {
  const { db } = firebase();
  if (target.isPrivate) {
    await setDoc(doc(col(target.uid, "followRequests"), viewerUid), { createdAt: serverTimestamp() });
    return;
  }
  const batch = writeBatch(db);
  batch.set(doc(col(viewerUid, "following"), target.uid), { createdAt: serverTimestamp() });
  batch.set(doc(col(target.uid, "followers"), viewerUid), { createdAt: serverTimestamp() });
  // A request left over from when the account was private.
  batch.delete(doc(col(target.uid, "followRequests"), viewerUid));
  await batch.commit();
}

/** Deletes both sides of a follow: `followerUid` stops following `targetUid`. */
function deleteFollow(followerUid: string, targetUid: string) {
  const batch = writeBatch(firebase().db);
  batch.delete(doc(col(followerUid, "following"), targetUid));
  batch.delete(doc(col(targetUid, "followers"), followerUid));
  return batch.commit();
}

export const unfollow = (viewerUid: string, targetUid: string) => deleteFollow(viewerUid, targetUid);

/** Removes someone from your followers. */
export const removeFollower = (viewerUid: string, followerUid: string) => deleteFollow(followerUid, viewerUid);

export const cancelRequest = (viewerUid: string, targetUid: string) =>
  deleteDoc(doc(col(targetUid, "followRequests"), viewerUid));

export const declineRequest = (viewerUid: string, requesterUid: string) =>
  deleteDoc(doc(col(viewerUid, "followRequests"), requesterUid));

/** Accepts a follow request: the requester now follows you. */
export function acceptRequest(viewerUid: string, requesterUid: string) {
  const batch = writeBatch(firebase().db);
  batch.set(doc(col(viewerUid, "followers"), requesterUid), { createdAt: serverTimestamp() });
  batch.set(doc(col(requesterUid, "following"), viewerUid), { createdAt: serverTimestamp() });
  batch.delete(doc(col(viewerUid, "followRequests"), requesterUid));
  return batch.commit();
}

/** Live uids in one of a user's follow collections, newest first. null while loading. */
function useUidList(uid: string | null, name: "following" | "followers" | "followRequests") {
  const [state, setState] = useState<{ key: string; uids: string[] } | null>(null);
  const key = `${uid}/${name}`;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(col(uid, name), orderBy("createdAt", "desc")),
      (snap) => setState({ key, uids: snap.docs.map((d) => d.id) }),
      (err) => {
        console.error(`Couldn't load ${name}`, err);
        setState({ key, uids: [] });
      },
    );
  }, [key, uid, name]);
  return state?.key === key ? state.uids : null;
}

/** Who `uid` follows, live. */
export const useFollowingUids = (uid: string | null) => useUidList(uid, "following");
/** Who follows `uid`, live. */
export const useFollowerUids = (uid: string | null) => useUidList(uid, "followers");
/** People asking to follow you (only you can read these), live. */
export const useFollowRequests = (uid: string | null) => useUidList(uid, "followRequests");

/**
 * Whether the viewer has asked to follow `target`, live. Only checked for private accounts;
 * a leftover request on a public account doesn't matter, since following it is instant.
 */
export function useRequested(viewerUid: string, target: UserProfile) {
  const [state, setState] = useState<{ key: string; requested: boolean } | null>(null);
  const key = `${viewerUid}/${target.uid}`;
  const watch = target.isPrivate && viewerUid !== target.uid;
  useEffect(() => {
    if (!watch) return;
    return onSnapshot(
      doc(col(target.uid, "followRequests"), viewerUid),
      (snap) => setState({ key, requested: snap.exists() }),
      () => setState({ key, requested: false }),
    );
  }, [key, watch, target.uid, viewerUid]);
  if (!watch) return false;
  return state?.key === key ? state.requested : null;
}

/**
 * Follower and following counts, from server-side aggregation. Pass something that changes
 * when they might have (e.g. the viewer's follow status) as `refresh` to fetch them again.
 */
export function useFollowCounts(uid: string, refresh?: unknown) {
  const [counts, setCounts] = useState<{ uid: string; followers: number | null; following: number | null } | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    const count = (name: "followers" | "following") =>
      getCountFromServer(col(uid, name))
        .then((s) => s.data().count)
        .catch(() => null);
    Promise.all([count("followers"), count("following")]).then(([followers, following]) => {
      if (live) setCounts({ uid, followers, following });
    });
    return () => {
      live = false;
    };
  }, [uid, refresh]);
  return counts?.uid === uid ? counts : { followers: null, following: null };
}

/** Profiles, cached for the session so lists and the feed don't refetch the same people. */
const profileCache = new Map<string, Promise<UserProfile | null>>();

export function getCachedProfile(uid: string) {
  let p = profileCache.get(uid);
  if (!p) {
    p = getProfile(uid).catch(() => {
      profileCache.delete(uid);
      return null;
    });
    profileCache.set(uid, p);
  }
  return p;
}

/** Profiles for a list of uids, in the same order; missing (deleted) accounts are left out. null while loading. */
export function useProfiles(uids: string[] | null) {
  const [state, setState] = useState<{ key: string; profiles: UserProfile[] } | null>(null);
  const key = uids?.join(",") ?? null;
  useEffect(() => {
    if (key == null) return;
    let live = true;
    const list = key ? key.split(",") : [];
    Promise.all(list.map(getCachedProfile)).then((profiles) => {
      if (live) setState({ key, profiles: profiles.filter((p): p is UserProfile => p != null) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return state && state.key === key ? state.profiles : null;
}

/** Users whose username starts with `text` (an optional leading @ is ignored). */
export async function searchUsers(text: string, max = 20): Promise<UserProfile[]> {
  const prefix = text.trim().toLowerCase().replace(/^@/, "");
  if (!prefix || !/^[a-z0-9_]+$/.test(prefix)) return [];
  const snap = await getDocs(
    query(
      collection(firebase().db, "users"),
      where("username", ">=", prefix),
      where("username", "<=", `${prefix}`),
      orderBy("username"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as UserProfile);
}

export interface FeedItem {
  ownerUid: string;
  workout: Workout;
}

/**
 * The home feed: the latest workouts from you and everyone you follow, newest first. Each
 * person's latest `max` are watched live (cache first, like useWorkouts) and merged, so the
 * newest `max` overall are always right. null until every source has answered once.
 * Sources that can't be read (e.g. someone went private) count as empty.
 */
export function useFeed(uids: string[] | null, max: number) {
  const [state, setState] = useState<{ key: string; bySource: Map<string, Workout[]> } | null>(null);
  const key = uids ? `${uids.join(",")}|${max}` : null;

  useEffect(() => {
    if (key == null) return;
    const sources = key.split("|")[0].split(",").filter(Boolean);
    const bySource = new Map<string, Workout[]>();
    const publish = () => {
      if (bySource.size === sources.length) setState({ key, bySource: new Map(bySource) });
    };
    const unsubscribes = sources.map((uid) =>
      onSnapshot(
        workoutsQuery(uid, { max }),
        (snap) => {
          bySource.set(uid, toWorkouts(snap));
          publish();
        },
        (err) => {
          if (err.code !== "permission-denied") console.error("Couldn't load feed", err);
          bySource.set(uid, []);
          publish();
        },
      ),
    );
    return () => unsubscribes.forEach((u) => u());
  }, [key, max]);

  if (!state || state.key !== key) return null;
  const items: FeedItem[] = [];
  for (const [ownerUid, workouts] of state.bySource) {
    for (const workout of workouts) items.push({ ownerUid, workout });
  }
  items.sort((a, b) => b.workout.startedAt - a.workout.startedAt);
  return items.slice(0, max);
}
