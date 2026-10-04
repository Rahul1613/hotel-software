from app.models import SessionLocal, SequentialCounter

def get_next_sequence(series_name: str, db=None) -> int:
    """
    Race-condition safe sequential counter generator using atomic DB update.
    Returns next 1-based integer for given series.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        counter = db.query(SequentialCounter).filter(SequentialCounter.series_name == series_name).with_for_update().first()
        if not counter:
            counter = SequentialCounter(series_name=series_name, last_val=1)
            db.add(counter)
            db.commit()
            return 1
        else:
            counter.last_val += 1
            next_val = counter.last_val
            db.commit()
            return next_val
    except Exception:
        db.rollback()
        # Fallback for SQLite which might not support with_for_update in all modes
        counter = db.query(SequentialCounter).filter(SequentialCounter.series_name == series_name).first()
        if not counter:
            counter = SequentialCounter(series_name=series_name, last_val=1)
            db.add(counter)
            db.commit()
            return 1
        counter.last_val += 1
        next_val = counter.last_val
        db.commit()
        return next_val
    finally:
        if should_close:
            db.close()
