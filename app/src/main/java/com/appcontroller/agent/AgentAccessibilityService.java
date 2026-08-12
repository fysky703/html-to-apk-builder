package com.appcontroller.agent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class AgentAccessibilityService extends AccessibilityService {
    public static AgentAccessibilityService instance;

    @Override public void onServiceConnected(){ instance=this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent e){}
    @Override public void onInterrupt(){}

    public void pressBack(){ performGlobalAction(GLOBAL_ACTION_BACK); }
    public void pressHome(){ performGlobalAction(GLOBAL_ACTION_HOME); }
    public void recents(){ performGlobalAction(GLOBAL_ACTION_RECENTS); }

    public boolean tap(float x,float y){
        Path p=new Path(); p.moveTo(x,y);
        return dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(p,0,80)).build(),null,null);
    }

    public boolean typeText(String text){
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null) return false;
        AccessibilityNodeInfo node=findEditable(root);
        if(node==null) return false;
        Bundle args=new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,text);
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,args);
    }

    AccessibilityNodeInfo findEditable(AccessibilityNodeInfo n){
        if(n.isEditable()) return n;
        for(int i=0;i<n.getChildCount();i++){
            AccessibilityNodeInfo r=findEditable(n.getChild(i));
            if(r!=null) return r;
        }
        return null;
    }
}
