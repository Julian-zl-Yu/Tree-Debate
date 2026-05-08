package com.jules.mapleboard.exception;

public class DuplicateOpinionReportException extends RuntimeException {
    public DuplicateOpinionReportException() {
        super("You already reported this opinion with this report type.");
    }
}
