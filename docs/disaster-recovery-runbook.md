# Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for handling disaster recovery scenarios in the SwiftEats food delivery platform. It covers database failures, system outages, and recovery procedures to ensure business continuity.

## Emergency Contacts

| Role | Primary Contact | Secondary Contact | Phone | Email |
|------|----------------|-------------------|-------|-------|
| DBA Team Lead | John Smith | Jane Doe | +1-555-0101 | dba-lead@swifteats.com |
| DevOps Lead | Mike Johnson | Sarah Wilson | +1-555-0102 | devops-lead@swifteats.com |
| Engineering Manager | Alex Brown | Chris Davis | +1-555-0103 | eng-manager@swifteats.com |
| On-Call Engineer | Rotation | Rotation | +1-555-0104 | oncall@swifteats.com |

## Recovery Time and Point Objectives

| Component | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|-----------|-------------------------------|--------------------------------|
| Primary Database | 15 minutes | 1 minute |
| Application Services | 10 minutes | 0 minutes |
| Cache Layer | 5 minutes | 0 minutes |
| File Storage | 30 minutes | 15 minutes |

## Disaster Scenarios

### 1. Primary Database Failure

#### Symptoms
- Primary database is unresponsive
- Application cannot connect to database
- Alert: `PostgresPrimaryDown`
- High error rates in application logs

#### Immediate Actions (0-5 minutes)
1. **Verify the Issue**
   ```bash
   # Check database connectivity
   kubectl exec -n swifteats postgres-primary-0 -- pg_isready -U postgres
   
   # Check pod status
   kubectl get pods -n swifteats -l app=postgres-primary
   
   # Check recent logs
   kubectl logs -n swifteats postgres-primary-0 --tail=100
   ```

2. **Assess Replica Status**
   ```bash
   # Check replica health
   kubectl get pods -n swifteats -l app=postgres-replica
   
   # Check replication lag
   kubectl exec -n swifteats postgres-replica-0 -- psql -U postgres -c "SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn(), pg_last_xact_replay_timestamp();"
   ```

3. **Notify Stakeholders**
   - Send alert to #incident-response Slack channel
   - Page on-call engineer if not already aware
   - Update status page: "Database issues - investigating"

#### Recovery Actions (5-15 minutes)

**Option A: Restart Primary Database**
```bash
# If pod is in error state, restart it
kubectl delete pod -n swifteats postgres-primary-0

# Wait for pod to come back up
kubectl wait --for=condition=ready pod -n swifteats postgres-primary-0 --timeout=300s

# Verify database is operational
kubectl exec -n swifteats postgres-primary-0 -- psql -U postgres -c "SELECT version();"
```

**Option B: Failover to Replica**
```bash
# Promote replica to primary
kubectl exec -n swifteats postgres-replica-0 -- touch /tmp/postgresql.trigger

# Update application configuration to point to new primary
kubectl patch configmap -n swifteats app-config -p '{"data":{"DB_HOST":"postgres-replica-service"}}'

# Restart application pods to pick up new config
kubectl rollout restart deployment -n swifteats swifteats-api
kubectl rollout restart deployment -n swifteats swifteats-worker

# Verify application connectivity
curl -f http://swifteats-api/health/database
```

#### Post-Recovery Actions (15-60 minutes)
1. **Verify System Health**
   ```bash
   # Check all services are healthy
   kubectl get pods -n swifteats
   
   # Run health checks
   curl -f http://swifteats-api/health
   
   # Check metrics in Grafana dashboard
   ```

2. **Investigate Root Cause**
   - Analyze database logs
   - Check system resources (CPU, memory, disk)
   - Review recent changes or deployments
   - Document findings in incident report

3. **Rebuild Failed Primary**
   ```bash
   # Scale down failed primary
   kubectl scale statefulset -n swifteats postgres-primary --replicas=0
   
   # Delete PVC if corrupted
   kubectl delete pvc -n swifteats postgres-primary-pvc
   
   # Scale back up to rebuild from replica
   kubectl scale statefulset -n swifteats postgres-primary --replicas=1
   ```

### 2. Replication Failure

#### Symptoms
- Alert: `PostgresReplicationLagHigh` or `PostgresReplicationStopped`
- Replica is behind primary by more than 5 minutes
- Replica shows as disconnected in monitoring

#### Immediate Actions (0-2 minutes)
1. **Check Replication Status**
   ```bash
   # On primary, check replication status
   kubectl exec -n swifteats postgres-primary-0 -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"
   
   # On replica, check recovery status
   kubectl exec -n swifteats postgres-replica-0 -- psql -U postgres -c "SELECT pg_is_in_recovery(), pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();"
   ```

2. **Check Network Connectivity**
   ```bash
   # Test connection from replica to primary
   kubectl exec -n swifteats postgres-replica-0 -- pg_isready -h postgres-primary-service -p 5432
   ```

#### Recovery Actions (2-10 minutes)

**Option A: Restart Replication**
```bash
# Restart replica pod
kubectl delete pod -n swifteats postgres-replica-0

# Monitor replication resumption
kubectl exec -n swifteats postgres-primary-0 -- psql -U postgres -c "SELECT * FROM pg_stat_replication;" --watch
```

**Option B: Rebuild Replica**
```bash
# Scale down replica
kubectl scale statefulset -n swifteats postgres-replica --replicas=0

# Delete replica data
kubectl delete pvc -n swifteats postgres-replica-pvc-postgres-replica-0

# Scale back up to rebuild
kubectl scale statefulset -n swifteats postgres-replica --replicas=1

# Monitor rebuild progress
kubectl logs -n swifteats postgres-replica-0 -f
```

### 3. Backup Failure

#### Symptoms
- Alert: `PostgresBackupFailed` or `PostgresBackupMissing`
- Backup job shows failed status
- No recent backup files in storage

#### Immediate Actions (0-5 minutes)
1. **Check Backup Job Status**
   ```bash
   # Check recent backup jobs
   kubectl get jobs -n swifteats -l app=postgres-backup
   
   # Check job logs
   kubectl logs -n swifteats job/postgres-full-backup-$(date +%Y%m%d) --tail=100
   ```

2. **Verify Backup Storage**
   ```bash
   # Check backup storage availability
   kubectl exec -n swifteats postgres-primary-0 -- ls -la /backups/
   
   # Check disk space
   kubectl exec -n swifteats postgres-primary-0 -- df -h /backups/
   ```

#### Recovery Actions (5-15 minutes)

**Manual Backup**
```bash
# Trigger manual full backup
kubectl create job --from=cronjob/postgres-full-backup -n swifteats postgres-manual-backup-$(date +%Y%m%d-%H%M)

# Monitor backup progress
kubectl logs -n swifteats job/postgres-manual-backup-$(date +%Y%m%d-%H%M) -f
```

**Fix Backup Issues**
```bash
# If storage is full, clean old backups
kubectl exec -n swifteats postgres-primary-0 -- find /backups/ -name "*.sql" -mtime +30 -delete

# If permissions issue, fix permissions
kubectl exec -n swifteats postgres-primary-0 -- chown -R postgres:postgres /backups/

# Restart backup cronjob
kubectl patch cronjob -n swifteats postgres-full-backup -p '{"spec":{"suspend":false}}'
```

### 4. Complete System Failure

#### Symptoms
- Multiple critical alerts
- All database pods down
- Application completely unavailable
- Kubernetes cluster issues

#### Immediate Actions (0-10 minutes)
1. **Assess Scope of Failure**
   ```bash
   # Check cluster status
   kubectl get nodes
   kubectl get pods --all-namespaces
   
   # Check system resources
   kubectl top nodes
   kubectl describe nodes
   ```

2. **Activate Disaster Recovery Plan**
   - Notify all stakeholders immediately
   - Activate incident bridge
   - Update status page: "Major outage - investigating"
   - Consider activating backup data center

#### Recovery Actions (10-60 minutes)

**Option A: Restore from Backup**
```bash
# Create new database instance
kubectl apply -f deploy/kubernetes/disaster-recovery/postgres-primary.yaml

# Wait for pod to be ready
kubectl wait --for=condition=ready pod -n swifteats postgres-primary-0 --timeout=600s

# Restore from latest backup
LATEST_BACKUP=$(find /backups/full -name "*.sql" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)
kubectl exec -n swifteats postgres-primary-0 -- pg_restore -U postgres -d swifteats "$LATEST_BACKUP"

# Verify data integrity
kubectl exec -n swifteats postgres-primary-0 -- psql -U postgres -c "SELECT count(*) FROM users;"
```

**Option B: Activate Secondary Site**
```bash
# Switch DNS to secondary data center
# Update load balancer configuration
# Activate standby systems
```

## Recovery Verification Checklist

After any recovery procedure, verify the following:

### Database Health
- [ ] Primary database is responding to queries
- [ ] Replica(s) are connected and replicating
- [ ] Replication lag is under 30 seconds
- [ ] No error messages in database logs
- [ ] Database performance metrics are normal

### Application Health
- [ ] All application pods are running
- [ ] Health check endpoints return 200 OK
- [ ] User authentication is working
- [ ] Order placement is working
- [ ] Payment processing is working
- [ ] Real-time features (tracking) are working

### Monitoring and Alerting
- [ ] All monitoring systems are operational
- [ ] Alerts have cleared or are acknowledged
- [ ] Dashboards show normal metrics
- [ ] Log aggregation is working

### Backup System
- [ ] Backup jobs are scheduled and running
- [ ] Latest backups are available and verified
- [ ] Backup verification tests pass
- [ ] Archive storage is accessible

## Post-Incident Procedures

### Immediate (0-2 hours)
1. **Update Status Page**
   - Mark incident as resolved
   - Provide brief summary of issue and resolution

2. **Notify Stakeholders**
   - Send all-clear to incident response team
   - Update management on resolution

3. **Monitor System Stability**
   - Watch metrics for 2 hours post-recovery
   - Be prepared for potential secondary issues

### Short-term (2-24 hours)
1. **Conduct Initial Post-Mortem**
   - Gather timeline of events
   - Identify immediate lessons learned
   - Document any temporary fixes that need permanent solutions

2. **Implement Immediate Improvements**
   - Fix any configuration issues discovered
   - Update monitoring if gaps were identified
   - Improve alerting if delays occurred

### Long-term (1-7 days)
1. **Full Post-Mortem Analysis**
   - Detailed root cause analysis
   - Review response procedures
   - Identify process improvements
   - Update runbooks based on lessons learned

2. **Implement Preventive Measures**
   - Infrastructure improvements
   - Process improvements
   - Training updates
   - Tool enhancements

## Testing and Validation

### Monthly Disaster Recovery Tests
1. **Backup Restoration Test**
   ```bash
   # Create test database
   kubectl exec -n swifteats postgres-primary-0 -- createdb test_restore
   
   # Restore latest backup to test database
   LATEST_BACKUP=$(find /backups/full -name "*.sql" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)
   kubectl exec -n swifteats postgres-primary-0 -- pg_restore -U postgres -d test_restore "$LATEST_BACKUP"
   
   # Verify data integrity
   kubectl exec -n swifteats postgres-primary-0 -- psql -U postgres -d test_restore -c "SELECT count(*) FROM users;"
   
   # Clean up
   kubectl exec -n swifteats postgres-primary-0 -- dropdb test_restore
   ```

2. **Failover Test**
   ```bash
   # Simulate primary failure (in maintenance window)
   kubectl scale statefulset -n swifteats postgres-primary --replicas=0
   
   # Promote replica
   kubectl exec -n swifteats postgres-replica-0 -- touch /tmp/postgresql.trigger
   
   # Update application configuration
   kubectl patch configmap -n swifteats app-config -p '{"data":{"DB_HOST":"postgres-replica-service"}}'
   
   # Restart applications
   kubectl rollout restart deployment -n swifteats swifteats-api
   
   # Verify functionality
   curl -f http://swifteats-api/health/database
   
   # Restore original configuration
   kubectl scale statefulset -n swifteats postgres-primary --replicas=1
   kubectl patch configmap -n swifteats app-config -p '{"data":{"DB_HOST":"postgres-primary-service"}}'
   kubectl rollout restart deployment -n swifteats swifteats-api
   ```

### Quarterly Full DR Tests
1. **Complete System Recovery**
   - Simulate complete data center failure
   - Test backup site activation
   - Verify RTO/RPO objectives
   - Test communication procedures

2. **Load Testing Post-Recovery**
   - Run performance tests after recovery
   - Verify system can handle normal load
   - Test auto-scaling functionality

## Runbook Maintenance

This runbook should be reviewed and updated:
- After each incident
- Monthly during team meetings
- Quarterly during DR tests
- When infrastructure changes are made
- When new team members join

**Last Updated:** [Current Date]
**Next Review Date:** [Current Date + 3 months]
**Document Owner:** DBA Team Lead
