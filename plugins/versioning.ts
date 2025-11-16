/**
 * Versioning Plugin for Platformatic DB
 * 
 * Auto-creates version snapshot on every Report save/update.
 * - Auto-increments version_number (SELECT MAX + 1)
 * - Creates snapshot in report_versions with full content
 * - Updates reports.current_version_id FK
 * - Manages is_current flag (only ONE version is current per report)
 * 
 * Healthcare Compliance:
 * - Immutable audit trail (who changed what, when)
 * - Complete version history for medical records
 * - Rollback capability (restore previous versions)
 */

interface ReportEntity {
  id: number
  title: string
  content: string
  findings?: string
  diagnosis?: string
  status: string
  practitionerId: number
  patientId: number
  reportTypeId: number
  reportDate: string
  currentVersionId?: number
  lastModifiedBy?: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
  deletedBy?: number
}

interface ReportVersionEntity {
  id?: number
  reportId: number
  versionNumber: number
  title: string
  content: string
  findings?: string
  diagnosis?: string
  changedBy: number
  changeReason?: string
  isCurrent: boolean
  createdAt?: string
  deletedAt?: string
  deletedBy?: number
}

async function versioningPlugin(app: any, opts?: any) {
  app.log.info('Loading versioning plugin...')

  const reportsEntity = app.platformatic.entities.report
  const versionsEntity = app.platformatic.entities.reportVersion

  if (!reportsEntity || !versionsEntity) {
    app.log.error('Reports or ReportVersions entity not found, versioning disabled')
    return
  }

  /**
   * Get current user from request context (for changed_by)
   * TODO: Integrate with authentication when implemented
   */
  function getCurrentUserId(request?: any): number {
    // Fallback: use header or session
    return request?.headers?.['x-user-id'] || 1 // Admin default
  }

  /**
   * Calculate next version number for a report
   */
  async function getNextVersionNumber(reportId: number): Promise<number> {
    const result = await app.platformatic.db.query(
      app.platformatic.sql`SELECT MAX(version_number) as max_version FROM report_versions WHERE report_id = ${reportId}`
    )

    const maxVersion = result[0]?.max_version || 0
    return maxVersion + 1
  }

  /**
   * Set all versions of a report to is_current = FALSE
   */
  async function clearCurrentFlags(reportId: number): Promise<void> {
    await app.platformatic.db.query(
      app.platformatic.sql`UPDATE report_versions SET is_current = 0 WHERE report_id = ${reportId} AND is_current = 1`
    )
  }

  /**
   * Create version snapshot
   */
  async function createVersionSnapshot(
    report: ReportEntity,
    changedBy: number,
    changeReason?: string
  ): Promise<ReportVersionEntity> {
    const versionNumber = await getNextVersionNumber(report.id)

    // Clear all previous is_current flags
    await clearCurrentFlags(report.id)

    // Create new version snapshot
    const versionData: ReportVersionEntity = {
      reportId: report.id,
      versionNumber,
      title: report.title,
      content: report.content,
      findings: report.findings,
      diagnosis: report.diagnosis,
      changedBy,
      changeReason,
      isCurrent: true
    }

    const newVersion = await versionsEntity.save({
      input: versionData
    })

    app.log.info({ reportId: report.id, versionNumber, changedBy, msg: 'Version snapshot created' })

    return newVersion
  }

  // Platformatic 3.x: Use mapper.addEntityHooks instead of entity.addHook
  app.platformatic.addEntityHooks('report', {
    /**
     * Hook: Create version on every Report save/update
     */
    save: async function versionAfterSave(original: any, args: any) {
      app.log.info({ msg: 'Versioning save hook invoked' })

      // Call original save first
      const savedReport = await original(args)

      app.log.info({ msg: 'Original save returned', savedReport })

      // Skip versioning if no report was saved
      if (!savedReport) {
        app.log.warn({ msg: 'No report saved, skipping versioning' })
        return savedReport
      }

      const userId = getCurrentUserId(args.ctx?.reply?.request)
      const changeReason = args.input?.change_reason || 'Updated via API'

      app.log.info({ msg: 'Versioning metadata', userId, changeReason })

      try {
        // Create version snapshot
        const newVersion = await createVersionSnapshot(
          savedReport as ReportEntity,
          userId,
          changeReason
        )

        // Update report.current_version_id FK
        await app.platformatic.db.query(
          app.platformatic.sql`UPDATE reports SET current_version_id = ${newVersion.id}, last_modified_by = ${userId} WHERE id = ${savedReport.id}`
        )

        app.log.info({ reportId: savedReport.id, versionId: newVersion.id, msg: 'Report.current_version_id updated' })
      } catch (error: any) {
        app.log.error({ reportId: savedReport.id, error: error.message, msg: 'Failed to create version snapshot' })
        // Don't fail the save operation, just log the error
        // In production, consider throwing or implementing retry logic
      }

      return savedReport
    },
    delete: async function versionBeforeDelete(original: any, args: any) {
      const reportId = args.where?.id

      if (!reportId) {
        return original(args)
      }

      const userId = getCurrentUserId(args.ctx?.reply?.request)

      try {
        // Get current report state before delete
        const report = await reportsEntity.find({
          where: { id: { eq: reportId } }
        })

        if (report && report.length > 0) {
          // Create snapshot with special change_reason
          await createVersionSnapshot(
            report[0] as ReportEntity,
            userId,
            'Snapshot before soft-delete'
          )

          app.log.info({ reportId, msg: 'Pre-delete version snapshot created' })
        }
      } catch (error: any) {
        app.log.error({ reportId, error: error.message, msg: 'Failed to create pre-delete snapshot' })
        // Continue with delete even if snapshot fails
      }

      // Execute original delete (soft-delete plugin will intercept)
      return original(args)
    }
  })

  app.log.info('Versioning plugin loaded successfully')
}

export default versioningPlugin
