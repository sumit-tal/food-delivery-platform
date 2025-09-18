#!/bin/bash

# SwiftEats Load Testing Suite Runner
# This script runs all load tests in sequence and generates a comprehensive report

set -e

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3000"}
WS_URL=${WS_URL:-"ws://localhost:3000"}
RESULTS_DIR="./load-test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${RESULTS_DIR}/load-test-report_${TIMESTAMP}.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}🚀 Starting SwiftEats Load Testing Suite${NC}"
echo -e "${BLUE}================================================${NC}"
echo "Base URL: ${BASE_URL}"
echo "WebSocket URL: ${WS_URL}"
echo "Results Directory: ${RESULTS_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Initialize report
cat > "${REPORT_FILE}" << EOF
# Load Test Report - ${TIMESTAMP}

## Test Configuration
- **Base URL**: ${BASE_URL}
- **WebSocket URL**: ${WS_URL}
- **Test Date**: $(date)
- **Environment**: $(uname -s) $(uname -r)

## Test Results Summary

EOF

# Function to run a test and capture results
run_test() {
    local test_name="$1"
    local test_file="$2"
    local duration="$3"
    local description="$4"
    
    echo -e "${YELLOW}📊 Running ${test_name}...${NC}"
    echo "Description: ${description}"
    echo "Duration: ${duration}"
    echo ""
    
    local result_file="${RESULTS_DIR}/${test_name}_${TIMESTAMP}.json"
    local log_file="${RESULTS_DIR}/${test_name}_${TIMESTAMP}.log"
    
    # Run the test
    if timeout 1800 k6 run --duration "${duration}" --out json="${result_file}" "${test_file}" > "${log_file}" 2>&1; then
        echo -e "${GREEN}✅ ${test_name} completed successfully${NC}"
        
        # Extract key metrics from results
        if [ -f "${result_file}" ]; then
            local avg_duration=$(jq -r '.metrics.http_req_duration.values.avg // "N/A"' "${result_file}")
            local p95_duration=$(jq -r '.metrics.http_req_duration.values["p(95)"] // "N/A"' "${result_file}")
            local error_rate=$(jq -r '.metrics.http_req_failed.values.rate // "N/A"' "${result_file}")
            local total_requests=$(jq -r '.metrics.http_reqs.values.count // "N/A"' "${result_file}")
            
            # Add to report
            cat >> "${REPORT_FILE}" << EOF
### ${test_name}

**Status**: ✅ PASSED  
**Description**: ${description}  
**Duration**: ${duration}

**Key Metrics**:
- Average Response Time: ${avg_duration}ms
- P95 Response Time: ${p95_duration}ms
- Error Rate: ${error_rate}%
- Total Requests: ${total_requests}

EOF
        fi
    else
        echo -e "${RED}❌ ${test_name} failed or timed out${NC}"
        
        # Add failure to report
        cat >> "${REPORT_FILE}" << EOF
### ${test_name}

**Status**: ❌ FAILED  
**Description**: ${description}  
**Duration**: ${duration}

**Error**: Test failed or timed out. Check log file: ${log_file}

EOF
    fi
    
    echo ""
}

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed. Please install k6 first.${NC}"
    echo "Installation: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if application is running
echo -e "${BLUE}🔍 Checking if application is running...${NC}"
if ! curl -f "${BASE_URL}/health" &> /dev/null; then
    echo -e "${RED}❌ Application is not running at ${BASE_URL}${NC}"
    echo "Please start the application first: npm run start:dev"
    exit 1
fi
echo -e "${GREEN}✅ Application is running${NC}"
echo ""

# Run all load tests
echo -e "${BLUE}🧪 Starting Load Tests${NC}"
echo "================================"

# 1. Basic Load Test
run_test "basic-load-test" \
         "test/load/k6-load-test.js" \
         "5m" \
         "Comprehensive mixed workload test with realistic user behavior"

# 2. Order Processing Load Test
run_test "order-processing-load" \
         "test/load/order-processing-load.js" \
         "10m" \
         "Order processing capacity test - Target: 500 orders/minute"

# 3. Location Updates Load Test
run_test "location-updates-load" \
         "test/load/location-updates-load.js" \
         "5m" \
         "Real-time location updates test - Target: 2,000 updates/second"

# 4. Failover Tests
run_test "failover-tests" \
         "test/load/failover-tests.js" \
         "3m" \
         "System resilience and failover capability testing"

# 5. Scaling Verification
run_test "scaling-verification" \
         "test/load/scaling-verification.js" \
         "15m" \
         "Auto-scaling behavior and performance under varying loads"

# 6. Performance Monitoring
run_test "performance-monitoring" \
         "test/load/performance-monitor.js" \
         "10m" \
         "Continuous performance monitoring and benchmark validation"

# Generate summary
echo -e "${BLUE}📋 Generating Test Summary${NC}"
echo "=============================="

# Count passed/failed tests
passed_tests=$(grep -c "✅ PASSED" "${REPORT_FILE}" || echo "0")
failed_tests=$(grep -c "❌ FAILED" "${REPORT_FILE}" || echo "0")
total_tests=$((passed_tests + failed_tests))

# Add summary to report
cat >> "${REPORT_FILE}" << EOF

## Overall Summary

- **Total Tests**: ${total_tests}
- **Passed**: ${passed_tests}
- **Failed**: ${failed_tests}
- **Success Rate**: $(( passed_tests * 100 / total_tests ))%

## Files Generated

- **Report**: ${REPORT_FILE}
- **Results Directory**: ${RESULTS_DIR}
- **Individual Test Results**: ${RESULTS_DIR}/*_${TIMESTAMP}.*

## Next Steps

1. Review individual test results for detailed metrics
2. Check failed tests logs for troubleshooting
3. Compare results with previous test runs
4. Update performance baselines if needed

---

**Generated by**: SwiftEats Load Testing Suite  
**Timestamp**: $(date)
EOF

# Display summary
echo ""
echo -e "${BLUE}📊 Load Testing Complete!${NC}"
echo "=========================="
echo -e "Total Tests: ${total_tests}"
echo -e "Passed: ${GREEN}${passed_tests}${NC}"
echo -e "Failed: ${RED}${failed_tests}${NC}"
echo -e "Success Rate: $(( passed_tests * 100 / total_tests ))%"
echo ""
echo -e "${BLUE}📄 Report Generated: ${REPORT_FILE}${NC}"
echo -e "${BLUE}📁 Results Directory: ${RESULTS_DIR}${NC}"

# Open report if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo -e "${YELLOW}Opening report in default editor...${NC}"
    open "${REPORT_FILE}"
fi

# Run Artillery test if available
if command -v artillery &> /dev/null; then
    echo ""
    echo -e "${YELLOW}🎯 Running Artillery Load Test...${NC}"
    
    artillery_log="${RESULTS_DIR}/artillery_${TIMESTAMP}.log"
    artillery_report="${RESULTS_DIR}/artillery_${TIMESTAMP}.html"
    
    if artillery run test/load/artillery-config.yml --output "${artillery_report}" > "${artillery_log}" 2>&1; then
        echo -e "${GREEN}✅ Artillery test completed${NC}"
        echo -e "${BLUE}📄 Artillery Report: ${artillery_report}${NC}"
    else
        echo -e "${RED}❌ Artillery test failed${NC}"
        echo -e "${YELLOW}Check log: ${artillery_log}${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 All load tests completed!${NC}"
echo -e "${BLUE}Check the results directory for detailed metrics and reports.${NC}"
