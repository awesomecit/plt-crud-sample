import { Entity, EntityHooks, Entities as DatabaseEntities, PlatformaticDatabaseConfig, PlatformaticDatabaseMixin } from '@platformatic/db'
import { PlatformaticApplication, PlatformaticServiceConfig } from '@platformatic/service'
import { type FastifyInstance } from 'fastify'

import { Attachment } from './attachment'
import { Patient } from './patient'
import { Practitioner } from './practitioner'
import { Report } from './report'
import { ReportTag } from './reportTag'
import { ReportType } from './reportType'
import { ReportVersion } from './reportVersion'
import { Tag } from './tag'
import { User } from './user'

export { Attachment } from './attachment'
export { Patient } from './patient'
export { Practitioner } from './practitioner'
export { Report } from './report'
export { ReportTag } from './reportTag'
export { ReportType } from './reportType'
export { ReportVersion } from './reportVersion'
export { Tag } from './tag'
export { User } from './user'

export interface Entities extends DatabaseEntities {
  attachment: Entity<Attachment>
  patient: Entity<Patient>
  practitioner: Entity<Practitioner>
  report: Entity<Report>
  reportTag: Entity<ReportTag>
  reportType: Entity<ReportType>
  reportVersion: Entity<ReportVersion>
  tag: Entity<Tag>
  user: Entity<User>
}

export interface EntityTypes {
  attachment: Attachment
  patient: Patient
  practitioner: Practitioner
  report: Report
  reportTag: ReportTag
  reportType: ReportType
  reportVersion: ReportVersion
  tag: Tag
  user: User
}

export interface EntitiesHooks {
  addEntityHooks(entityName: 'attachment', hooks: EntityHooks<Attachment>): any
  addEntityHooks(entityName: 'patient', hooks: EntityHooks<Patient>): any
  addEntityHooks(entityName: 'practitioner', hooks: EntityHooks<Practitioner>): any
  addEntityHooks(entityName: 'report', hooks: EntityHooks<Report>): any
  addEntityHooks(entityName: 'reportTag', hooks: EntityHooks<ReportTag>): any
  addEntityHooks(entityName: 'reportType', hooks: EntityHooks<ReportType>): any
  addEntityHooks(entityName: 'reportVersion', hooks: EntityHooks<ReportVersion>): any
  addEntityHooks(entityName: 'tag', hooks: EntityHooks<Tag>): any
  addEntityHooks(entityName: 'user', hooks: EntityHooks<User>): any
}

export interface SchemaGetters {
  getSchema(schemaId: 'attachment'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof Attachment]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'patient'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof Patient]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'practitioner'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof Practitioner]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'report'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof Report]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'reportTag'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof ReportTag]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'reportType'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof ReportType]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'reportVersion'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof ReportVersion]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'tag'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof Tag]: { type: string, nullable?: boolean } },
    required: string[]
  }

getSchema(schemaId: 'user'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof User]: { type: string, nullable?: boolean } },
    required: string[]
  }
}

export type ServerInstance<Configuration = PlatformaticDatabaseConfig> = FastifyInstance & {
  platformatic: PlatformaticApplication<Configuration> & PlatformaticDatabaseMixin<Entities> & EntitiesHooks & SchemaGetters
}
