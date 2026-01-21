# Manual Test Checklist and Results

## Checklist
- [ ] Create normal order shows in PENDING
- [ ] Create VIP order queues before all normal orders but behind existing VIP
- [ ] Order numbers are unique and increasing
- [ ] + Bot starts processing pending order and completes after ~10 seconds
- [ ] Bot continues to next order when available
- [ ] Bot becomes IDLE when no pending orders
- [ ] - Bot removes newest bot and returns in-flight order to PENDING
- [ ] Processing resumes with remaining bots
- [ ] UI reflects PENDING / PROCESSING / COMPLETE accurately

## Results
- Status: Not run
- Notes:
