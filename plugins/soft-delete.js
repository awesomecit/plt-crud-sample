'use strict'

/**
 * Soft Delete Plugin for Platformatic DB
 * 
 * Intercepts DELETE operations and converts them to UPDATE (set deleted_at).
 * Auto-filters deleted records from queries unless explicitly requested.
 * 
 * GDPR/HIPAA Compliance: 
 * - Maintains audit trail (deleted_by, deleted_at)
 * - Prevents accidental hard deletes
 * - Allows data recovery within retention period
 */

module.exports = async function softDeletePlugin(app, opts) {
  app.log.info('Loading soft-delete plugin...')
  
  // Entities with soft delete support
  const softDeleteEntities = [
    'report',
    'reportType',
    'practitioner', 
    'patient',
    'user',
    'tag',
    'reportTag',
    'reportVersion',
    'attachment'
  ]
  
  // Get current user from request context (for deleted_by)
  // TODO: Integrate with authentication when implemented
  function getCurrentUserId(request) {
    // Fallback: use header or session
    return request.headers['x-user-id'] || 1 // Admin default
  }
  
  for (const entityName of softDeleteEntities) {
    const entity = app.platformatic.entities[entityName]
    
    if (!entity) {
      app.log.warn(`Entity ${entityName} not found, skipping soft-delete`)
      continue
    }
    
    // Platformatic 3.x: Use mapper.addEntityHooks instead of entity.addHook
    app.platformatic.addEntityHooks(entityName, {
      // Hook: Override DELETE to do soft delete
      delete: async function softDelete(original, args) {
        const userId = getCurrentUserId(args.ctx?.reply?.request || {})
        
        app.log.info({ entity: entityName, id: args.where.id, userId }, 'Soft deleting record')
        
        // Convert DELETE to UPDATE
        const result = await entity.save({
          input: {
            id: args.where.id,
            deletedAt: new Date().toISOString(),
            deletedBy: userId
          },
          ctx: args.ctx
        })
        
        return result
      },
      
      // Hook: Auto-filter deleted records from find operations
      find: async function filterDeleted(original, args) {
        // Allow explicit includeDeleted flag
        const includeDeleted = args.includeDeleted || false
        delete args.includeDeleted // Remove custom flag
        
        if (!includeDeleted) {
          // Add deleted_at IS NULL filter
          args.where = args.where || {}
          args.where.deletedAt = { eq: null }
        }
        
        return original(args)
      }
    })
    
    app.log.info(`Soft-delete enabled for entity: ${entityName}`)
  }
  
  // Custom routes for soft-delete management
  
  // GET /api/:entity/deleted - List deleted records (admin only)
  app.get('/api/:entity/deleted', async (request, reply) => {
    const { entity: entityName } = request.params
    const entity = app.platformatic.entities[entityName]
    
    if (!entity) {
      return reply.code(404).send({ error: 'Entity not found' })
    }
    
    // TODO: Check admin role when auth is implemented
    
    const deleted = await entity.find({
      where: {
        deletedAt: { neq: null }
      }
    })
    
    return deleted
  })
  
  // POST /api/:entity/:id/restore - Restore soft-deleted record
  app.post('/api/:entity/:id/restore', async (request, reply) => {
    const { entity: entityName, id } = request.params
    const entity = app.platformatic.entities[entityName]
    
    if (!entity) {
      return reply.code(404).send({ error: 'Entity not found' })
    }
    
    // TODO: Check admin role when auth is implemented
    
    const restored = await entity.save({
      input: {
        id: parseInt(id),
        deletedAt: null,
        deletedBy: null
      }
    })
    
    request.log.info({ entity: entityName, id }, 'Record restored')
    
    return restored
  })
  
  // POST /api/:entity/:id/hard-delete - PERMANENT delete (admin only, dangerous!)
  app.post('/api/:entity/:id/hard-delete', async (request, reply) => {
    const { entity: entityName, id } = request.params
    const entity = app.platformatic.entities[entityName]
    
    if (!entity) {
      return reply.code(404).send({ error: 'Entity not found' })
    }
    
    // TODO: Strict admin-only check + confirmation token
    
    // Remove hooks temporarily for hard delete
    const result = await app.platformatic.db.query(`
      DELETE FROM ${entity.table} WHERE id = ?
    `, [parseInt(id)])
    
    request.log.warn({ entity: entityName, id }, 'HARD DELETE executed - record permanently removed')
    
    return { success: true, message: 'Record permanently deleted' }
  })
  
  app.log.info('Soft-delete plugin loaded successfully')
}

module.exports.autoload = false // Manual registration in platformatic.json
