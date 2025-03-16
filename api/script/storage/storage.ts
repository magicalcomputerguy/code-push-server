// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as q from "q";
import * as stream from "stream";
import * as error from "../error";

import Promise = q.Promise;

export enum ErrorCode {
  ConnectionFailed = 0,
  NotFound = 1,
  AlreadyExists = 2,
  TooLarge = 3,
  Expired = 4,
  Invalid = 5,
  Other = 99,
}

// Human-readable strings
export module ReleaseMethod {
  export const Upload = "Upload";
  export const Promote = "Promote";
  export const Rollback = "Rollback";
}

export module Permissions {
  export const Owner = "Owner";
  export const Collaborator = "Collaborator";
}

export interface StorageError extends error.CodePushError {
  code: ErrorCode;
}

/**
 * Specifies an account with the power to manage apps, deployments and packages
 */
export interface Account {
  azureAdId?: string;
  /*generated*/ createdTime: number;
  /*const*/ email: string;
  gitHubId?: string;
  /*generated*/ id?: string;
  microsoftId?: string;
  /*const*/ name: string;
}

export interface CollaboratorProperties {
  /*generated*/ accountId?: string;
  /*generated*/ isCurrentAccount?: boolean;
  permission: string;
}

export interface CollaboratorMap {
  [email: string]: CollaboratorProperties;
}

export interface App {
  /*generated*/ collaborators?: CollaboratorMap;
  /*generated*/ createdTime: number;
  /*generated*/ id?: string;
  name: string;
}

export interface Deployment {
  /*generated*/ createdTime: number;
  /*generated*/ id?: string;
  name: string;
  key: string;
  package?: Package;
}

export interface DeploymentInfo {
  appId: string;
  deploymentId: string;
}

export interface BlobInfo {
  size: number;
  url: string;
}

export interface PackageHashToBlobInfoMap {
  [packageHash: string]: BlobInfo;
}

export interface Package {
  appVersion: string;
  blobUrl: string;
  description: string;
  diffPackageMap?: PackageHashToBlobInfoMap;
  isDisabled: boolean;
  isMandatory: boolean;
  /*generated*/ label?: string;
  manifestBlobUrl: string;
  originalDeployment?: string; // Set on "Promote"
  originalLabel?: string; // Set on "Promote" and "Rollback"
  packageHash: string;
  releasedBy?: string;
  releaseMethod?: string; // "Upload", "Promote" or "Rollback". Unknown if unspecified
  rollout?: number;
  size: number;
  uploadTime: number;
}

export interface AccessKey {
  createdBy: string;
  createdTime: number;
  expires: number;
  /*legacy*/ description?: string;
  friendlyName: string;
  /*generated*/ id?: string;
  /*generated*/ isSession?: boolean;
  name: string;
}

/**
 * Storage API Notes:
 * - All ID's are generated by the Storage API and returned on creation. Don't specify this field when you create an object.
 * - Update methods merge the properties that you specify ('null' will unset properties, 'undefined' will be ignored). Make sure you
 *   set the id of the object you'd like to update.
 * - The Storage implementation should verify that the whole specified id chain is correct, not just the leaf id
 * - The Storage implementation should never return a falsey value (null, undefined, "") from any of its methods, and instead reject
 *   the promise with a Storage.Error object where relevant. It should return an empty array ([]) when retrieving a collection with zero
 *   elements, except when the specified id chain does not exist, in which case the promise should be rejected as usual.
 */
export interface Storage {
  checkHealth(): Promise<void>;

  addAccount(account: Account): Promise<string>;
  getAccount(accountId: string): Promise<Account>;
  getAccountByEmail(email: string): Promise<Account>;
  getAccountIdFromAccessKey(accessKey: string): Promise<string>;
  updateAccount(email: string, updates: Account): Promise<void>;

  addApp(accountId: string, app: App): Promise<App>;
  getApps(accountId: string): Promise<App[]>;
  getApp(accountId: string, appId: string): Promise<App>;
  removeApp(accountId: string, appId: string): Promise<void>;
  transferApp(accountId: string, appId: string, email: string): Promise<void>;
  updateApp(accountId: string, app: App): Promise<void>;

  addCollaborator(accountId: string, appId: string, email: string): Promise<void>;
  getCollaborators(accountId: string, appId: string): Promise<CollaboratorMap>;
  removeCollaborator(accountId: string, appId: string, email: string): Promise<void>;

  addDeployment(accountId: string, appId: string, deployment: Deployment): Promise<string>;
  getDeployment(accountId: string, appId: string, deploymentId: string): Promise<Deployment>;
  getDeploymentInfo(deploymentKey: string): Promise<DeploymentInfo>;
  getDeployments(accountId: string, appId: string): Promise<Deployment[]>;
  removeDeployment(accountId: string, appId: string, deploymentId: string): Promise<void>;
  updateDeployment(accountId: string, appId: string, deployment: Deployment): Promise<void>;

  commitPackage(accountId: string, appId: string, deploymentId: string, appPackage: Package): Promise<Package>;
  clearPackageHistory(accountId: string, appId: string, deploymentId: string): Promise<void>;
  getPackageHistoryFromDeploymentKey(deploymentKey: string): Promise<Package[]>;
  getPackageHistory(accountId: string, appId: string, deploymentId: string): Promise<Package[]>;
  updatePackageHistory(accountId: string, appId: string, deploymentId: string, history: Package[]): Promise<void>;

  addBlob(blobId: string, addstream: stream.Readable, streamLength: number): Promise<string>;
  getBlobUrl(blobId: string): Promise<string>;
  removeBlob(blobId: string): Promise<void>;

  addAccessKey(accountId: string, accessKey: AccessKey): Promise<string>;
  getAccessKey(accountId: string, accessKeyId: string): Promise<AccessKey>;
  getAccessKeys(accountId: string): Promise<AccessKey[]>;
  removeAccessKey(accountId: string, accessKeyId: string): Promise<void>;
  updateAccessKey(accountId: string, accessKey: AccessKey): Promise<void>;

  dropAll(): Promise<void>;
}

export function clone<T>(source: T): T {
  if (!source) {
    return source;
  }

  return JSON.parse(JSON.stringify(source));
}

export function merge(original: any, updates: any): void {
  for (const property in updates) {
    original[property] = updates[property];
  }
}

export function isOwnedByCurrentUser(app: App): boolean {
  for (const email in app.collaborators) {
    const collaborator: CollaboratorProperties = app.collaborators[email];
    if (collaborator.isCurrentAccount && collaborator.permission === Permissions.Owner) {
      return true;
    }
  }

  return false;
}

export function getOwnerEmail(app: App): string {
  for (const email in app.collaborators) {
    if (app.collaborators[email].permission === Permissions.Owner) {
      return email;
    }
  }

  return null;
}

export function isPrototypePollutionKey(key: string): boolean {
  return ['__proto__', 'constructor', 'prototype'].includes(key);
}

export function storageError(errorCode: ErrorCode, message?: string): StorageError {
  const storageError = <StorageError>error.codePushError(error.ErrorSource.Storage, message);
  storageError.code = errorCode;
  return storageError;
}

// A convenience wrapper on top of any storage implementation to resolve names instead of ID's
export class NameResolver {
  private _storage: Storage;

  constructor(storage: Storage) {
    this._storage = storage;
  }

  // Interface
  public static isDuplicate(items: App[], name: string): boolean;
  public static isDuplicate<T extends { name: string }>(items: T[], name: string): boolean;
  // Definition
  public static isDuplicate<T extends { name: string }>(items: T[], name: string): boolean {
    if (!items.length) return false;

    if ((<App>(<any>items[0])).collaborators) {
      // Use 'app' overload
      for (let i = 0; i < items.length; i++) {
        const app = <App>(<any>items[i]);
        if (app.name === name && isOwnedByCurrentUser(app)) return true;
      }

      return false;
    } else {
      // Use general overload
      return !!NameResolver.findByName(items, name);
    }
  }

  // Interface
  public static findByName(items: App[], displayName: string): App;
  public static findByName<T extends { name: string }>(items: T[], name: string): T;
  // Definition
  public static findByName<T extends { name: string }>(items: T[], name: string): T {
    if (!items.length) return null;

    if ((<App>(<any>items[0])).collaborators) {
      // Use 'app' overload
      return <T>(<any>NameResolver.findAppByName(<App[]>(<any>items), name));
    } else {
      // Use general overload
      for (let i = 0; i < items.length; i++) {
        // For access keys, match both the "name" and "friendlyName" fields.
        if (items[i].name === name || name === (<AccessKey>(<any>items[i])).friendlyName) {
          return items[i];
        }
      }

      return null;
    }
  }

  private static findAppByName(apps: App[], displayName: string): App {
    let rawName: string;
    let ownerEmail: string;

    const components: string[] = displayName.split(":");
    if (components.length === 1) {
      rawName = components[0];
    } else if (components.length === 2) {
      ownerEmail = components[0];
      rawName = components[1];
    } else {
      return null;
    }

    const candidates: App[] = apps.filter((app: App) => app.name === rawName);
    if (ownerEmail) {
      for (let i = 0; i < candidates.length; i++) {
        const app: App = candidates[i];
        if (app.collaborators[ownerEmail] && app.collaborators[ownerEmail].permission === Permissions.Owner) {
          return app;
        }
      }
    } else {
      // If no owner email is specified:
      // 1. Select the only app if possible
      // 2. Otherwise select the app owned by the current account
      // 3. Otherwise the query is ambiguous and no apps will be selected

      if (candidates.length === 1) {
        return candidates[0];
      }

      for (let i = 0; i < candidates.length; i++) {
        if (isOwnedByCurrentUser(candidates[i])) return candidates[i];
      }
    }

    return null;
  }

  private static errorMessageOverride(code: ErrorCode, message: string): (error: StorageError) => any {
    return (error: StorageError) => {
      if (error.code === code) {
        error.message = message;
      }

      throw error;
    };
  }

  public resolveAccessKey(accountId: string, name: string): Promise<AccessKey> {
    return this._storage
      .getAccessKeys(accountId)
      .then((accessKeys: AccessKey[]): AccessKey => {
        const accessKey: AccessKey = NameResolver.findByName(accessKeys, name);
        if (!accessKey) throw storageError(ErrorCode.NotFound);

        return accessKey;
      })
      .catch(NameResolver.errorMessageOverride(ErrorCode.NotFound, `Access key "${name}" does not exist.`));
  }

  public resolveApp(accountId: string, name: string, permission?: string): Promise<App> {
    return this._storage
      .getApps(accountId)
      .then((apps: App[]): App => {
        const app: App = NameResolver.findByName(apps, name);
        if (!app) throw storageError(ErrorCode.NotFound);

        return app;
      })
      .catch(NameResolver.errorMessageOverride(ErrorCode.NotFound, `App "${name}" does not exist.`));
  }

  public resolveDeployment(accountId: string, appId: string, name: string): Promise<Deployment> {
    return this._storage
      .getDeployments(accountId, appId)
      .then((deployments: Deployment[]): Deployment => {
        const deployment: Deployment = NameResolver.findByName(deployments, name);
        if (!deployment) throw storageError(ErrorCode.NotFound);

        return deployment;
      })
      .catch(NameResolver.errorMessageOverride(ErrorCode.NotFound, `Deployment "${name}" does not exist.`));
  }
}
