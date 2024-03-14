public class B extends A {
    private int numB;

    public int numK;

    public B() {
        System.out.println("create in B");
        this.numB = 3;
    }

    @Override
    public void display() {
        System.out.println("Number in B: " + numB);
    }

    public void B_func() {
        System.out.println("in B_func");
    }
}
